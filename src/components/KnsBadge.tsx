import React from 'react';
import knsLogo from '@/assets/kns-logo.png';
import MobileTooltip from './MobileTooltip';

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
    <MobileTooltip
      content={<p className="font-medium">{knsDomain}</p>}
      side="top"
    >
      <div className={`relative inline-flex ${className}`}>
        <img 
          src={knsLogo} 
          alt="KNS" 
          className={`${sizeClasses[size]} rounded-full object-cover`}
        />
      </div>
    </MobileTooltip>
  );
};

export default KnsBadge;
