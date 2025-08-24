import React from 'react';
import kaspaLogo from '@/assets/kaspa-logo.png';

interface KaspaIconProps {
  size?: number;
  className?: string;
}

const KaspaIcon: React.FC<KaspaIconProps> = ({ size = 24, className = '' }) => {
  return (
    <img 
      src={kaspaLogo}
      alt="Kaspa"
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  );
};

export default KaspaIcon;