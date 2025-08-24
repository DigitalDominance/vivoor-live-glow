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
        
        // Get the tip data from database to access the stored sender info
        const { data: tipData, error: tipError } = await supabase
          .from('tips')
          .select('sender_name, sender_avatar, tip_message')
          .eq('id', tip.id)
          .single();

        console.log('Tip data from DB:', tipData);

        const notification: TipNotificationData = {
          id: tip.id,
          amount: tip.amount,
          sender: tipData?.sender_name || tip.sender || 'Anonymous',
          message: tipData?.tip_message && tipData.tip_message.length > 0 ? tipData.tip_message : undefined,
          senderAvatar: tipData?.sender_avatar
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