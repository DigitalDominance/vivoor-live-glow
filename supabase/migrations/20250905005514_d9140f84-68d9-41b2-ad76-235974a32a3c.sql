-- Update get_clips_with_profiles_and_stats to exclude clips from banned users
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
    AND (p.banned IS NOT TRUE OR p.banned IS NULL)  -- Exclude clips from banned users
  ORDER BY 
    CASE WHEN _order_by = 'views' THEN c.views END DESC NULLS LAST,
    CASE WHEN _order_by = 'likes' THEN (SELECT COUNT(*) FROM public.clip_likes cl WHERE cl.clip_id = c.id) END DESC NULLS LAST,
    CASE WHEN _order_by = 'created_at' THEN c.created_at END DESC NULLS LAST
  LIMIT LEAST(GREATEST(_limit, 0), 100)
  OFFSET GREATEST(_offset, 0);
END;
$$;

-- Update profile functions to include banned status
CREATE OR REPLACE FUNCTION public.get_public_profile_secure(_id text)
RETURNS TABLE(id text, display_name text, handle text, avatar_url text, bio text, created_at timestamp with time zone, banner_url text, banned boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    p.id,
    p.display_name,
    p.handle,
    p.avatar_url,
    p.bio,
    p.created_at,
    p.banner_url,
    p.banned
  FROM public.profiles p
  WHERE p.id = _id;
$$;

-- Create admin function to delete stream (not just end it)
CREATE OR REPLACE FUNCTION public.admin_delete_stream(stream_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only allow deletion if called by admin function
  -- The application layer should handle admin authentication
  DELETE FROM public.streams
  WHERE id = stream_id_param;
END;
$$;