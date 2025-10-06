import React, { useState } from 'react';
import TipNotification, { TipNotificationData } from './TipNotification';
import { ProcessedTip } from '@/hooks/useTipMonitoring';
import { supabase } from '@/integrations/supabase/client';
import { blurBadWords } from '@/lib/badWords';

interface TipDisplayProps {
  newTips: ProcessedTip[];
  onTipShown: (tipId: string) => void;
  isFullscreen?: boolean;
  userJoinedAt: Date;
  onTipProcessed?: (tip: { id: string; sender: string; senderAvatar?: string; amount: number; message?: string; timestamp: number }) => void;
}

const TipDisplay: React.FC<TipDisplayProps> = ({ newTips, onTipShown, isFullscreen = false, userJoinedAt, onTipProcessed }) => {
  const [activeTips, setActiveTips] = useState<TipNotificationData[]>([]);
  const MAX_TIPS = 3; // Maximum 3 tips displayed at once

  // Process new tips into notifications with profile resolution
  React.useEffect(() => {
    const processNewTips = async () => {
      console.log('TipDisplay - Processing new tips:', newTips);
      for (const tip of newTips) {
        console.log('Processing individual tip:', tip);
        
        // Skip tips that occurred before user joined
        if (tip.timestamp && new Date(tip.timestamp) < userJoinedAt) {
          console.log('Skipping tip from before user joined:', tip.id);
          onTipShown(tip.id);
          continue;
        }
        
        // Get the tip data from database to access the stored sender info
        const { data: tipData, error: tipError } = await supabase
          .from('tips')
          .select('sender_name, sender_avatar, tip_message, sender_address, created_at')
          .eq('id', tip.id)
          .single();

        console.log('Tip data from DB:', tipData);
        
        // Double-check timestamp filtering using DB data
        if (tipData?.created_at && new Date(tipData.created_at) < userJoinedAt) {
          console.log('Skipping tip from before user joined (DB timestamp):', tip.id);
          onTipShown(tip.id);
          continue;
        }

        let finalSenderName = tipData?.sender_name || 'Anonymous';
        let finalSenderAvatar = tipData?.sender_avatar;

        // If we don't have stored sender info, try to resolve from wallet address
        if (!tipData?.sender_name && tipData?.sender_address) {
          // Use RPC function to safely check profile without exposing sensitive data
          const { data: profiles, error: profileError } = await supabase
            .rpc('get_public_profile_secure', { _id: tipData.sender_address });

          console.log('Profile lookup result:', { profiles, profileError, senderAddress: tipData.sender_address });
          
          const profile = profiles && profiles.length > 0 ? profiles[0] : null;
          if (profile) {
            finalSenderName = profile.display_name || profile.handle || 'Anonymous';
            finalSenderAvatar = profile.avatar_url;
          }
        }

        const notification: TipNotificationData = {
          id: tip.id,
          amount: tip.amount,
          sender: finalSenderName,
          message: tipData?.tip_message && tipData.tip_message.length > 0 ? blurBadWords(tipData.tip_message) : undefined,
          senderAvatar: finalSenderAvatar
        };

        console.log('Created notification:', notification);

        // Notify parent with full tip info including sender details
        if (onTipProcessed) {
          onTipProcessed({
            id: tip.id,
            sender: finalSenderName,
            senderAvatar: finalSenderAvatar,
            amount: tip.amount,
            message: notification.message,
            timestamp: tip.timestamp ? new Date(tip.timestamp).getTime() : Date.now()
          });
        }

        setActiveTips(prev => {
          // Check if this tip is already being shown
          if (prev.some(t => t.id === notification.id)) {
            return prev;
          }
          // Maintain max 3 tips by removing oldest if necessary
          const updatedTips = [...prev, notification];
          return updatedTips.slice(-MAX_TIPS);
        });

        // Mark as shown
        onTipShown(tip.id);
      }
    };

    if (newTips.length > 0) {
      processNewTips();
    }
  }, [newTips, onTipShown, userJoinedAt, onTipProcessed]);

  const handleTipComplete = (tipId: string) => {
    setActiveTips(prev => prev.filter(tip => tip.id !== tipId));
  };

  console.log('TipDisplay render - newTips:', newTips.length, 'activeTips:', activeTips.length);

  return (
    <div className="absolute top-4 right-4 z-[9999] space-y-2 pointer-events-none">
      {activeTips.slice(-MAX_TIPS).map(tip => (
        <TipNotification
          key={tip.id}
          tip={tip}
          onComplete={() => handleTipComplete(tip.id)}
          duration={15000}
          isFullscreen={isFullscreen}
        />
      ))}
    </div>
  );
};

export default TipDisplay;