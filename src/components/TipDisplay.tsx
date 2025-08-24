import React, { useState } from 'react';
import TipNotification, { TipNotificationData } from './TipNotification';
import { ProcessedTip } from '@/hooks/useTipMonitoring';
import { supabase } from '@/integrations/supabase/client';

interface TipDisplayProps {
  newTips: ProcessedTip[];
  onTipShown: (tipId: string) => void;
  isFullscreen?: boolean;
}

const TipDisplay: React.FC<TipDisplayProps> = ({ newTips, onTipShown, isFullscreen = false }) => {
  const [activeTips, setActiveTips] = useState<TipNotificationData[]>([]);

  // Process new tips into notifications
  React.useEffect(() => {
    const processNewTips = async () => {
      for (const tip of newTips) {
        console.log('Processing tip:', tip);
        
        // First, try to get the tip with sender/recipient addresses from database
        const { data: tipData, error: tipError } = await supabase
          .from('tips')
          .select('sender_address, decrypted_message')
          .eq('id', tip.id)
          .single();

        console.log('Tip data from DB:', tipData);

        let profile = null;
        let senderName = tip.sender;
        let tipMessage = tip.message;

        if (tipData?.sender_address) {
          // Look up profile by sender's kaspa address
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('display_name, handle, avatar_url')
            .eq('kaspa_address', tipData.sender_address)
            .single();

          console.log('Profile lookup result:', { profileData, profileError, senderAddress: tipData.sender_address });
          profile = profileData;
        }

        // Parse decrypted message for additional details
        if (tipData?.decrypted_message) {
          try {
            const decrypted = typeof tipData.decrypted_message === 'string' 
              ? JSON.parse(tipData.decrypted_message) 
              : tipData.decrypted_message;
            
            console.log('Decrypted message:', decrypted);
            
            if (decrypted?.sender) {
              senderName = decrypted.sender;
            }
            if (decrypted?.message) {
              tipMessage = decrypted.message;
            }
          } catch (e) {
            console.error('Error parsing decrypted message:', e);
          }
        }

        const notification: TipNotificationData = {
          id: tip.id,
          amount: tip.amount,
          sender: profile?.display_name || profile?.handle || senderName || 'Anonymous',
          message: tipMessage && tipMessage.length > 0 && !tipMessage.startsWith('VIVR-TIP1:') ? tipMessage : undefined,
          senderAvatar: profile?.avatar_url
        };

        console.log('Created notification:', notification);

        setActiveTips(prev => {
          // Check if this tip is already being shown
          if (prev.some(t => t.id === notification.id)) {
            return prev;
          }
          return [...prev, notification];
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
      {activeTips.map(tip => (
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