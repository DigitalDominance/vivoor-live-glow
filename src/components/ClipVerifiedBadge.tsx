import React from 'react';
import VerifiedBadge from './VerifiedBadge';
import { useUserVerification } from '@/hooks/useUserVerification';

interface ClipVerifiedBadgeProps {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const ClipVerifiedBadge: React.FC<ClipVerifiedBadgeProps> = ({ userId, size = 'sm', className = '' }) => {
  const { data: verificationData } = useUserVerification(userId);
  
  return (
    <VerifiedBadge 
      isVerified={verificationData?.isVerified || false}
      size={size}
      className={className}
    />
  );
};

export default ClipVerifiedBadge;