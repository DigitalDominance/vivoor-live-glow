import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import KaspaIcon from '@/components/KaspaIcon';
import { X } from 'lucide-react';

export interface TipNotificationData {
  id: string;
  amount: number; // in KAS
  sender: string;
  message?: string;
  senderAvatar?: string;
}

interface TipNotificationProps {
  tip: TipNotificationData;
  onComplete: () => void;
  duration?: number;
  isFullscreen?: boolean;
}

const TipNotification: React.FC<TipNotificationProps> = ({ 
  tip, 
  onComplete, 
  duration = 15000,
  isFullscreen = false
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onComplete, 300); // Wait for exit animation
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="relative w-80 pointer-events-auto"
        >
          {/* Glass container with gradient outline */}
          <div className="relative rounded-lg p-[1px] bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink">
            <div className="bg-black/95 backdrop-blur-md rounded-lg p-3 shadow-2xl">
              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors pointer-events-auto z-10"
              >
                <X size={12} className="text-white" />
              </button>

              {/* Main content row */}
              <div className="flex items-center gap-3 relative">
                {/* Profile picture - positioned down and to the right */}
                <Avatar className="w-6 h-6 ring-1 ring-brand-cyan/30 flex-shrink-0 -mt-1 ml-20">
                  <AvatarImage src={tip.senderAvatar} alt={tip.sender} />
                  <AvatarFallback className="text-xs bg-gradient-to-br from-brand-cyan to-brand-iris text-white font-medium">
                    {tip.sender.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Username and amount */}
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold text-sm truncate mb-1">
                    {tip.sender}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink bg-clip-text text-transparent text-lg font-bold">
                      {tip.amount}
                    </span>
                    <KaspaIcon size={16} />
                  </div>
                </div>
              </div>
              
              {/* Message */}
              {tip.message && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                  className="text-white/80 text-xs mt-2 p-2 bg-white/5 rounded border border-white/10 break-words leading-relaxed"
                >
                  {tip.message}
                </motion.div>
              )}
              
              {/* Animated progress bar */}
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: duration / 1000, ease: "linear" }}
                className="h-0.5 bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink rounded-full mt-2"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TipNotification;