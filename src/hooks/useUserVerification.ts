import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useUserVerification(userId?: string | null) {
  return useQuery({
    queryKey: ['user-verification', userId],
    queryFn: async () => {
      if (!userId) return { isVerified: false };
      
      const { data } = await supabase.rpc('user_has_active_verification', { 
        user_id_param: userId 
      });
      
      const verification = data?.[0];
      return {
        isVerified: verification?.is_verified || false,
        expiresAt: verification?.expires_at,
        paymentType: verification?.payment_type
      };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}