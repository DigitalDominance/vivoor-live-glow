import React, { useState } from 'react';
import TipNotification, { TipNotificationData } from './TipNotification';
import { ProcessedTip } from '@/hooks/useTipMonitoring';

interface TipDisplayProps {
  newTips: ProcessedTip[];
  onTipShown: (tipId: string) => void;
}

const TipDisplay: React.FC<TipDisplayProps> = ({ newTips, onTipShown }) => {
  const [activeTips, setActiveTips] = useState<TipNotificationData[]>([]);

  // Process new tips into notifications
  React.useEffect(() => {
    newTips.forEach(tip => {
      const notification: TipNotificationData = {
        id: tip.id,
        amount: tip.amount,
        sender: tip.sender,
        message: tip.message,
        senderAvatar: undefined // Could be fetched from profiles table
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
    });
  }, [newTips, onTipShown]);

  const handleTipComplete = (tipId: string) => {
    setActiveTips(prev => prev.filter(tip => tip.id !== tipId));
  };

  return (
    <div className="fixed top-0 right-0 z-50 p-4 space-y-2 pointer-events-none">
      {activeTips.map(tip => (
        <TipNotification
          key={tip.id}
          tip={tip}
          onComplete={() => handleTipComplete(tip.id)}
          duration={5000}
        />
      ))}
    </div>
  );
};

export default TipDisplay;