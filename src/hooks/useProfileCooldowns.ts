import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useProfileCooldowns(userId?: string | null) {
  const { data: usernameCooldown } = useQuery({
    queryKey: ['username-cooldown', userId],
    queryFn: async () => {
      if (!userId) return { can_change: true, cooldown_ends_at: null };
      
      const { data } = await supabase.rpc('can_change_username', { 
        user_id_param: userId 
      });
      
      return data?.[0] || { can_change: true, cooldown_ends_at: null };
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // Cache for 30 seconds
  });

  const { data: avatarCooldown } = useQuery({
    queryKey: ['avatar-cooldown', userId],
    queryFn: async () => {
      if (!userId) return { can_change: true, cooldown_ends_at: null };
      
      const { data } = await supabase.rpc('can_change_avatar', { 
        user_id_param: userId 
      });
      
      return data?.[0] || { can_change: true, cooldown_ends_at: null };
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // Cache for 30 seconds
  });

  return {
    usernameCooldown: usernameCooldown || { can_change: true, cooldown_ends_at: null },
    avatarCooldown: avatarCooldown || { can_change: true, cooldown_ends_at: null },
  };
}