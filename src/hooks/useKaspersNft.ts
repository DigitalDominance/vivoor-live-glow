import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export function useKaspersNft(userId?: string | null, showKaspersBadge?: boolean) {
  // Trigger verification check on component mount
  useEffect(() => {
    if (!userId || !showKaspersBadge) return;

    // Fire and forget - verification happens in background
    supabase.functions.invoke('verify-kaspers-nft-on-view', {
      body: { userId }
    }).catch(err => {
      console.error('Background KASPERS NFT verification failed:', err);
    });
  }, [userId, showKaspersBadge]);

  return useQuery({
    queryKey: ['kaspers-nft', userId],
    queryFn: async () => {
      if (!userId || !showKaspersBadge) return null;
      
      const { data, error } = await supabase.rpc('get_user_kaspers_nft', { 
        user_id_param: userId 
      });
      
      if (error) {
        console.error('Error fetching KASPERS NFT:', error);
        return null;
      }
      
      return data?.[0] || null;
    },
    enabled: !!userId && !!showKaspersBadge,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes to match verification window
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });
}
