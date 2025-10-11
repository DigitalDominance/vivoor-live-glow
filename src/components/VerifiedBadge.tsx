import React from 'react';
import { CheckCircle2 } from 'lucide-react';

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
  );
};

export default VerifiedBadge;