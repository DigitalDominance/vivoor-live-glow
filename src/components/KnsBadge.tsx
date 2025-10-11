import React from 'react';
import knsLogo from '@/assets/kns-logo.png';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface KnsBadgeProps {
  knsDomain?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const KnsBadge: React.FC<KnsBadgeProps> = ({ knsDomain, size = 'sm', className = '' }) => {
  if (!knsDomain) return null;

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`relative inline-flex ${className}`}>
            <div 
              className={`${sizeClasses[size]} rounded-full overflow-hidden`}
              style={{
                background: 'linear-gradient(135deg, hsl(var(--brand-cyan)), hsl(var(--brand-iris)), hsl(var(--brand-pink)))',
                padding: '2px'
              }}
            >
              <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                <img 
                  src={knsLogo} 
                  alt="KNS" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="bg-card border-white/10 text-foreground"
        >
          <p className="font-medium">{knsDomain}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default KnsBadge;
