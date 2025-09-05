-- Add banned field to profiles table for user management
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT false;

-- Add index for better performance when filtering banned users
CREATE INDEX IF NOT EXISTS idx_profiles_banned ON public.profiles(banned);

-- Create function to ban/unban users (admin only)
CREATE OR REPLACE FUNCTION public.admin_ban_user(user_id_param text, ban_status boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update user ban status
  UPDATE public.profiles
  SET banned = ban_status, updated_at = now()
  WHERE id = user_id_param;
  
  -- If banning user, end all their active streams
  IF ban_status = true THEN
    UPDATE public.streams
    SET is_live = false, ended_at = COALESCE(ended_at, now())
    WHERE user_id = user_id_param AND is_live = true;
  END IF;
END;
$$;

-- Create function to get all users with pagination (admin only)
CREATE OR REPLACE FUNCTION public.admin_get_users(
  search_query text DEFAULT NULL,
  limit_param integer DEFAULT 50,
  offset_param integer DEFAULT 0
)
RETURNS TABLE(
  id text,
  handle text,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone,
  banned boolean,
  stream_count integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.handle,
    p.display_name,
    p.avatar_url,
    p.created_at,
    p.banned,
    (SELECT COUNT(*)::integer FROM public.streams s WHERE s.user_id = p.id) as stream_count
  FROM public.profiles p
  WHERE (
    search_query IS NULL 
    OR p.handle ILIKE '%' || search_query || '%' 
    OR p.display_name ILIKE '%' || search_query || '%'
    OR p.id ILIKE '%' || search_query || '%'
  )
  ORDER BY p.created_at DESC
  LIMIT LEAST(GREATEST(limit_param, 0), 100)
  OFFSET GREATEST(offset_param, 0);
END;
$$;

-- Create function to end stream by admin
CREATE OR REPLACE FUNCTION public.admin_end_stream(stream_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.streams
  SET is_live = false, ended_at = COALESCE(ended_at, now())
  WHERE id = stream_id_param AND is_live = true;
END;
$$;