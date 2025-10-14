import React from 'react';
import MobileTooltip from './MobileTooltip';

interface KaspersBadgeProps {
  tokenId?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const KaspersBadge: React.FC<KaspersBadgeProps> = ({ tokenId, size = 'sm', className = '' }) => {
  if (!tokenId) return null;

  const imageUrl = `https://cache.krc721.stream/krc721/mainnet/optimized/KASPERS/${tokenId}`;

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <MobileTooltip
      content={<p className="font-medium">Owner of KASPERS #{tokenId}</p>}
      side="top"
    >
      <div className={`relative inline-flex ${className}`}>
        <div className="relative p-[2px] rounded-full bg-gradient-to-br from-brand-cyan via-brand-pink to-brand-iris shadow-[0_0_15px_rgba(139,92,246,0.5)]">
          <img 
            src={imageUrl} 
            alt={`KASPERS #${tokenId}`}
            className={`${sizeClasses[size]} rounded-full object-cover bg-background`}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      </div>
    </MobileTooltip>
  );
};

export default KaspersBadge;
