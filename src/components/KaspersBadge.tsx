import React from 'react';
import MobileTooltip from './MobileTooltip';

interface KaspersBadgeProps {
  tokenId?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const KaspersBadge: React.FC<KaspersBadgeProps> = ({ tokenId, size = 'sm', className = '' }) => {
  if (!tokenId) return null;

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <MobileTooltip
      content={<p className="font-medium">KASPERS NFT #{tokenId}</p>}
      side="top"
    >
      <div className={`relative inline-flex ${className}`}>
        <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 flex items-center justify-center text-white text-[8px] font-bold shadow-lg`}>
          K
        </div>
      </div>
    </MobileTooltip>
  );
};

export default KaspersBadge;
