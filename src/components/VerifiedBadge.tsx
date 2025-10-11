import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isVerified?: boolean;
}

const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ size = 'sm', className = '', isVerified = true }) => {
  if (!isVerified) return null;

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative inline-flex">
            <CheckCircle2 
              className={`${sizeClasses[size]} text-white ${className}`}
              style={{
                background: 'linear-gradient(135deg, hsl(var(--brand-cyan)), hsl(var(--brand-iris)), hsl(var(--brand-pink)))',
                borderRadius: '50%',
                padding: '2px'
              }}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="bg-card border-white/10 text-foreground"
        >
          <p className="font-medium">This User Is Verified!</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default VerifiedBadge;