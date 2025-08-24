import React from 'react';

interface KasLogoProps {
  size?: number;
  className?: string;
}

const KasLogo: React.FC<KasLogoProps> = ({ size = 24, className = '' }) => {
  return (
    <div 
      className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg 
        width={size * 0.6} 
        height={size * 0.6} 
        viewBox="0 0 24 24" 
        fill="none"
      >
        <path 
          d="M8 6L16 12L8 18V6Z" 
          fill="currentColor" 
          className="text-black"
          transform="rotate(45 12 12)"
        />
        <path 
          d="M12 2L20 8L12 14V2Z" 
          fill="currentColor" 
          className="text-black"
          transform="rotate(45 12 12)"
        />
      </svg>
    </div>
  );
};

export default KasLogo;