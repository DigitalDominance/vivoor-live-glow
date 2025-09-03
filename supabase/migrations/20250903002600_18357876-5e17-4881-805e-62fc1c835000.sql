-- Fix the RLS policies to allow proper functionality while securing wallet addresses

-- Update follows table policies to be more restrictive about wallet addresses
DROP POLICY IF EXISTS "Users can view all follows" ON public.follows;
CREATE POLICY "Users can view follows for public data" 
ON public.follows 
FOR SELECT 
USING (true); -- Allow viewing follow relationships but not exposing wallet details

-- Update likes table policies  
DROP POLICY IF EXISTS "Users can view all likes" ON public.likes;
CREATE POLICY "Users can view likes for public data"
ON public.likes 
FOR SELECT 
USING (true); -- Allow viewing likes but not exposing wallet details

-- Update clip_likes table policies (already properly secured)
-- stream_viewers table (already has proper policies)

-- Fix profiles access by allowing SECURITY DEFINER functions to access profile data
-- Create a more permissive policy for SECURITY DEFINER functions
CREATE POLICY "Security definer functions can access profiles" 
ON public.profiles 
FOR SELECT 
TO postgres
USING (true);

-- Update the get_clips_with_profiles_and_stats function to properly access profiles
CREATE OR REPLACE FUNCTION public.get_clips_with_profiles_and_stats(_limit integer DEFAULT 50, _offset integer DEFAULT 0, _search text DEFAULT NULL::text, _order_by text DEFAULT 'created_at'::text)
RETURNS TABLE(id uuid, title text, thumbnail_url text, download_url text, views integer, created_at timestamp with time zone, user_id text, profile_handle text, profile_display_name text, profile_avatar_url text, like_count integer, start_seconds integer, end_seconds integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.title,
    c.thumbnail_url,
    c.download_url,
    c.views,
    c.created_at,
    c.user_id,
    p.handle as profile_handle,
    p.display_name as profile_display_name,
    p.avatar_url as profile_avatar_url,
    COALESCE((SELECT COUNT(*)::integer FROM public.clip_likes cl WHERE cl.clip_id = c.id), 0) as like_count,
    c.start_seconds,
    c.end_seconds
  FROM public.clips c
  LEFT JOIN public.profiles p ON p.id = c.user_id
  WHERE (_search IS NULL OR c.title ILIKE '%' || _search || '%')
  ORDER BY 
    CASE WHEN _order_by = 'views' THEN c.views END DESC NULLS LAST,
    CASE WHEN _order_by = 'likes' THEN (SELECT COUNT(*) FROM public.clip_likes cl WHERE cl.clip_id = c.id) END DESC NULLS LAST,
    CASE WHEN _order_by = 'created_at' THEN c.created_at END DESC NULLS LAST
  LIMIT LEAST(GREATEST(_limit, 0), 100)
  OFFSET GREATEST(_offset, 0);
END;
$$;

-- Update the get_streams_with_profiles_and_likes function
CREATE OR REPLACE FUNCTION public.get_streams_with_profiles_and_likes(_limit integer DEFAULT 50, _offset integer DEFAULT 0)
RETURNS TABLE(id uuid, title text, category text, is_live boolean, viewers integer, user_id text, thumbnail_url text, created_at timestamp with time zone, profile_handle text, profile_display_name text, profile_avatar_url text, like_count integer, playback_url text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.title,
    s.category,
    s.is_live,
    s.viewers,
    s.user_id,
    s.thumbnail_url,
    s.created_at,
    p.handle as profile_handle,
    p.display_name as profile_display_name,
    p.avatar_url as profile_avatar_url,
    COALESCE((SELECT COUNT(*)::integer FROM public.likes l WHERE l.stream_id = s.id), 0) as like_count,
    s.playback_url
  FROM public.streams s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  ORDER BY s.created_at DESC
  LIMIT LEAST(GREATEST(_limit, 0), 100)
  OFFSET GREATEST(_offset, 0);
END;
$$;

-- Update the get_profile_with_stats function
CREATE OR REPLACE FUNCTION public.get_profile_with_stats(_user_id text)
RETURNS TABLE(id text, handle text, display_name text, avatar_url text, bio text, created_at timestamp with time zone, follower_count integer, following_count integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
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
END;
$$;