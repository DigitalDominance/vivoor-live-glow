import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import KasLogo from '@/components/KasLogo';

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
  duration = 5000,
  isFullscreen = false
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 300); // Wait for exit animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="relative max-w-sm pointer-events-auto"
        >
          <div className="bg-gradient-to-r from-green-500/90 to-emerald-600/90 backdrop-blur-md rounded-xl p-4 shadow-2xl border border-green-400/20">
            <div className="flex items-start gap-3">
              {/* Animated Kaspa Logo */}
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                className="flex-shrink-0"
              >
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <KasLogo size={24} />
                </div>
              </motion.div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={tip.senderAvatar} alt={tip.sender} />
                    <AvatarFallback className="text-xs bg-white/20 text-white">
                      {tip.sender.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-white font-medium text-sm">
                    {tip.sender}
                  </span>
                </div>
                
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                  className="flex items-center gap-2 text-white font-bold text-lg mb-1"
                >
                  <span>{tip.amount}</span>
                  <KasLogo size={20} />
                </motion.div>
                
                {tip.message && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.3 }}
                    className="text-white/90 text-sm line-clamp-2"
                  >
                    "{tip.message}"
                  </motion.p>
                )}
              </div>
            </div>
            
            {/* Animated progress bar */}
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: duration / 1000, ease: "linear" }}
              className="h-1 bg-white/30 rounded-full mt-3"
            />
          </div>
          
          {/* Floating KAS symbols animation */}
          <div className="absolute -top-2 -right-2 pointer-events-none">
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
                <KasLogo size={16} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TipNotification;