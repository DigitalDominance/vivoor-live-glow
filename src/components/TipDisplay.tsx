import React, { useState } from 'react';
import TipNotification, { TipNotificationData } from './TipNotification';
import { ProcessedTip } from '@/hooks/useTipMonitoring';
import { supabase } from '@/integrations/supabase/client';
import { blurBadWords } from '@/lib/badWords';

interface TipDisplayProps {
  newTips: ProcessedTip[];
  onTipShown: (tipId: string) => void;
  isFullscreen?: boolean;
}

const TipDisplay: React.FC<TipDisplayProps> = ({ newTips, onTipShown, isFullscreen = false }) => {
  const [activeTips, setActiveTips] = useState<TipNotificationData[]>([]);
  const MAX_TIPS = 3; // Maximum 3 tips displayed at once

  // Process new tips into notifications with profile resolution
  React.useEffect(() => {
    const processNewTips = async () => {
      for (const tip of newTips) {
        console.log('Processing tip:', tip);
        
        // Get the tip data from database to access the stored sender info
        const { data: tipData, error: tipError } = await supabase
          .from('tips')
          .select('sender_name, sender_avatar, tip_message, sender_address')
          .eq('id', tip.id)
          .single();

        console.log('Tip data from DB:', tipData);

        let finalSenderName = tipData?.sender_name || 'Anonymous';
        let finalSenderAvatar = tipData?.sender_avatar;

        // If we don't have stored sender info, try to resolve from wallet address
        if (!tipData?.sender_name && tipData?.sender_address) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('display_name, handle, avatar_url')
            .eq('kaspa_address', tipData.sender_address)
            .single();

          console.log('Profile lookup result:', { profile, profileError, senderAddress: tipData.sender_address });
          
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
  }, [newTips, onTipShown]);

  const handleTipComplete = (tipId: string) => {
    setActiveTips(prev => prev.filter(tip => tip.id !== tipId));
  };

  return (
    <div className="absolute top-4 right-4 z-[100] space-y-2 pointer-events-none">
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