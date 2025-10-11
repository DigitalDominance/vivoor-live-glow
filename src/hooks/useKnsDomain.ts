import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useKnsDomain(userId?: string | null, showKnsBadge?: boolean) {
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
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
