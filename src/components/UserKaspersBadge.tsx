import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useKaspersNft } from '@/hooks/useKaspersNft';
import { Loader2 } from 'lucide-react';
import KaspersBadge from './KaspersBadge';

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
  
  return <KaspersBadge tokenId={kaspersNft.token_id} size={size} className={className} />;
};

export default UserKaspersBadge;
