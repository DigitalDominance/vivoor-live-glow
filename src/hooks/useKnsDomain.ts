import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export function useKnsDomain(userId?: string | null, showKnsBadge?: boolean) {
  // Trigger verification check on component mount
  useEffect(() => {
    if (!userId || !showKnsBadge) return;

    // Fire and forget - verification happens in background
    supabase.functions.invoke('verify-kns-on-view', {
      body: { userId }
    }).catch(err => {
      console.error('Background KNS verification failed:', err);
    });
  }, [userId, showKnsBadge]);

  return useQuery({
    queryKey: ['kns-domain', userId],
    queryFn: async () => {
      if (!userId || !showKnsBadge) return null;
      
      const { data, error } = await supabase.rpc('get_user_kns_domain', { 
        user_id_param: userId 
      });
      
      if (error) {
        console.error('Error fetching KNS domain:', error);
        return null;
      }
      
      return data?.[0] || null;
    },
    enabled: !!userId && !!showKnsBadge,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes to match verification window
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });
}
