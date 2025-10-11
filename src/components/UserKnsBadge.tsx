import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import KnsBadge from './KnsBadge';
import { useKnsDomain } from '@/hooks/useKnsDomain';

interface UserKnsBadgeProps {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const UserKnsBadge: React.FC<UserKnsBadgeProps> = ({ userId, size = 'md', className = '' }) => {
  const { data: profileData } = useQuery({
    queryKey: ['profile-kns-badge', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('show_kns_badge')
        .eq('id', userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId
  });

  const { data: knsDomain } = useKnsDomain(userId, profileData?.show_kns_badge);
  
  if (!profileData?.show_kns_badge || !knsDomain) return null;
  
  return <KnsBadge knsDomain={knsDomain.full_name} size={size} className={className} />;
};

export default UserKnsBadge;
