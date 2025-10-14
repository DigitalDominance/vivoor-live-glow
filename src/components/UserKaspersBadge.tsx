import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useKaspersNft } from '@/hooks/useKaspersNft';
import { Loader2 } from 'lucide-react';

interface UserKaspersBadgeProps {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const UserKaspersBadge: React.FC<UserKaspersBadgeProps> = ({ userId, size = 'md', className = '' }) => {
  const { data: profileData } = useQuery({
    queryKey: ['profile-kaspers-badge', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('show_kaspers_badge')
        .eq('id', userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId
  });

  const { data: kaspersNft, isLoading } = useKaspersNft(userId, profileData?.show_kaspers_badge);
  
  if (!profileData?.show_kaspers_badge) return null;
  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
  if (!kaspersNft?.token_id) return null;

  const imageUrl = `https://cache.krc721.stream/krc721/mainnet/optimized/KASPERS/${kaspersNft.token_id}`;

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px] gap-1',
    md: 'px-2 py-0.5 text-xs gap-1.5',
    lg: 'px-2.5 py-1 text-sm gap-2'
  };

  const imgSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };
  
  return (
    <div 
      className={`inline-flex items-center rounded-full font-semibold bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 text-white ${sizeClasses[size]} ${className}`}
      title={`KASPERS NFT #${kaspersNft.token_id}`}
    >
      <img 
        src={imageUrl} 
        alt={`KASPERS #${kaspersNft.token_id}`}
        className={`${imgSizes[size]} rounded-full object-cover`}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <span>#{kaspersNft.token_id}</span>
    </div>
  );
};

export default UserKaspersBadge;
