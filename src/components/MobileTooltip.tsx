import React, { useState, useEffect, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MobileTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

const MobileTooltip: React.FC<MobileTooltipProps> = ({ children, content, side = 'top' }) => {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Detect if device is mobile
    const checkMobile = () => {
      setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!isMobile || !open) return;

    // Close tooltip when clicking anywhere outside
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    // Add slight delay to prevent immediate closing
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 100);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open, isMobile]);

  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (isMobile) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(!open);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip open={isMobile ? open : undefined}>
        <TooltipTrigger asChild onClick={handleClick}>
          <div ref={triggerRef} className="inline-flex items-center">
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side={side}
          align="center"
          sideOffset={8}
          className="bg-card border-white/10 text-foreground z-[100]"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default MobileTooltip;
