import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import KaspersBadge from './KaspersBadge';
import { useKaspersNft } from '@/hooks/useKaspersNft';

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

  const { data: kaspersNft } = useKaspersNft(userId, profileData?.show_kaspers_badge);
  
  if (!profileData?.show_kaspers_badge || !kaspersNft) return null;
  
  return <KaspersBadge tokenId={kaspersNft.token_id} size={size} className={className} />;
};

export default UserKaspersBadge;
