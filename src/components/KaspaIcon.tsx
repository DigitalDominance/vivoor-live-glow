import React from 'react';

interface KaspaIconProps {
  size?: number;
  className?: string;
}

const KaspaIcon: React.FC<KaspaIconProps> = ({ size = 24, className = '' }) => {
  return (
    <img 
      src="/lovable-uploads/a759010b-dfc9-4e39-a99a-2a2fb1104f6a.png"
      alt="Kaspa"
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  );
};

export default KaspaIcon;