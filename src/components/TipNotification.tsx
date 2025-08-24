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
          className="relative max-w-md w-full pointer-events-auto"
        >
          {/* Glass container with gradient outline */}
          <div className="relative rounded-xl p-[2px] bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink">
            <div className="bg-black/95 backdrop-blur-md rounded-[10px] p-4 shadow-2xl">
              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors pointer-events-auto z-10"
              >
                <X size={14} className="text-white" />
              </button>

              {/* Profile and name row */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2 flex-1">
                  <Avatar className="w-7 h-7 ring-1 ring-brand-cyan/30">
                    <AvatarImage src={tip.senderAvatar} alt={tip.sender} />
                    <AvatarFallback className="text-xs bg-gradient-to-br from-brand-cyan to-brand-iris text-white font-medium">
                      {tip.sender.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-white font-medium text-sm">
                    {tip.sender}
                  </span>
                </div>
                
                {/* Amount on the right side */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                  className="flex items-center gap-2"
                >
                  <span className="bg-gradient-to-r from-brand-cyan to-brand-iris bg-clip-text text-transparent text-lg font-bold">
                    {tip.amount}
                  </span>
                  <KaspaIcon size={18} />
                </motion.div>
              </div>
              
              {/* Message below */}
              {tip.message && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.3 }}
                  className="text-white/90 text-sm line-clamp-2 bg-white/5 rounded-lg p-2 border border-white/10"
                >
                  {tip.message}
                </motion.p>
              )}
              
              {/* Animated progress bar with gradient */}
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: duration / 1000, ease: "linear" }}
                className="h-1 bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink rounded-full mt-3"
              />
            </div>
          </div>
          
          {/* Floating KAS symbols animation */}
          <div className="absolute -top-2 -left-2 pointer-events-none">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 0, x: 0 }}
                animate={{ 
                  opacity: [0, 1, 0], 
                  y: [-20, -40], 
                  x: [0, (i - 1) * 10] 
                }}
                transition={{ 
                  duration: 2, 
                  delay: i * 0.3,
                  repeat: Infinity,
                  repeatDelay: 2
                }}
                className="absolute"
              >
                <div className="w-4 h-4 bg-gradient-to-r from-brand-cyan to-brand-iris rounded-full flex items-center justify-center">
                  <KaspaIcon size={12} />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TipNotification;