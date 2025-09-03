-- Update get_clips_with_profiles_and_stats to use safe profile access
CREATE OR REPLACE FUNCTION public.get_clips_with_profiles_and_stats(_limit integer DEFAULT 50, _offset integer DEFAULT 0, _search text DEFAULT NULL::text, _order_by text DEFAULT 'created_at'::text)
RETURNS TABLE(id uuid, title text, thumbnail_url text, download_url text, views integer, created_at timestamp with time zone, user_id text, profile_handle text, profile_display_name text, profile_avatar_url text, like_count integer, start_seconds integer, end_seconds integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
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
  OFFSET GREATEST(_offset, 0)
$$;

-- Update get_streams_with_profiles_and_likes to use safe profile access
CREATE OR REPLACE FUNCTION public.get_streams_with_profiles_and_likes(_limit integer DEFAULT 50, _offset integer DEFAULT 0)
RETURNS TABLE(id uuid, title text, category text, is_live boolean, viewers integer, user_id text, thumbnail_url text, created_at timestamp with time zone, profile_handle text, profile_display_name text, profile_avatar_url text, like_count integer, playback_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
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
  OFFSET GREATEST(_offset, 0)
$$;

-- Update get_profile_with_stats to use safe profile access  
CREATE OR REPLACE FUNCTION public.get_profile_with_stats(_user_id text)
RETURNS TABLE(id text, handle text, display_name text, avatar_url text, bio text, created_at timestamp with time zone, follower_count integer, following_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
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