-- Drop the problematic public_profiles view 
DROP VIEW IF EXISTS public.public_profiles;

-- Create a new function to get public profile data safely
CREATE OR REPLACE FUNCTION public.get_profile_with_stats(_user_id TEXT)
RETURNS TABLE(
  id TEXT,
  handle TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  follower_count INTEGER,
  following_count INTEGER
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT 
    p.id,
    p.handle,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.created_at,
    (SELECT COUNT(*)::INTEGER FROM public.follows WHERE following_id = p.id) as follower_count,
    (SELECT COUNT(*)::INTEGER FROM public.follows WHERE follower_id = p.id) as following_count
  FROM public.profiles p
  WHERE p.id = _user_id;
$$;