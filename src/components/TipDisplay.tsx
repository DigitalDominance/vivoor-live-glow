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
        // Fetch sender profile info
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, handle, avatar_url')
          .eq('kaspa_address', tip.sender)
          .single();

        const notification: TipNotificationData = {
          id: tip.id,
          amount: tip.amount,
          sender: profile?.display_name || profile?.handle || tip.sender.slice(0, 8),
          message: tip.message,
          senderAvatar: profile?.avatar_url
        };

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