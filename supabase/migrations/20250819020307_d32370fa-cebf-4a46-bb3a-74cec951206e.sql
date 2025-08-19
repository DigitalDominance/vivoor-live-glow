-- Create a database function to get streams with user profiles
CREATE OR REPLACE FUNCTION public.get_streams_with_profiles(_limit integer DEFAULT 50, _offset integer DEFAULT 0)
RETURNS TABLE(
  id uuid,
  title text,
  category text,
  is_live boolean,
  viewers integer,
  user_id text,
  thumbnail_url text,
  created_at timestamp with time zone,
  profile_handle text,
  profile_display_name text,
  profile_avatar_url text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
    p.avatar_url as profile_avatar_url
  FROM public.streams s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  ORDER BY s.created_at DESC
  LIMIT LEAST(GREATEST(_limit, 0), 100)
  OFFSET GREATEST(_offset, 0)
$function$;

-- Create a function to monitor and end disconnected Livepeer streams
CREATE OR REPLACE FUNCTION public.monitor_livepeer_streams()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  ended_count integer := 0;
  stream_record RECORD;
BEGIN
  -- Get all live streams that haven't sent a heartbeat in the last minute
  FOR stream_record IN
    SELECT id, user_id, title
    FROM public.streams
    WHERE is_live = true
    AND (
      last_heartbeat IS NULL 
      OR last_heartbeat < now() - interval '1 minute'
    )
  LOOP
    -- Log the stream being ended
    RAISE LOG 'Auto-ending disconnected stream: % (user: %, title: %)', 
      stream_record.id, stream_record.user_id, stream_record.title;
    
    -- End the stream
    UPDATE public.streams
    SET 
      is_live = false,
      ended_at = COALESCE(ended_at, now())
    WHERE id = stream_record.id;
    
    ended_count := ended_count + 1;
  END LOOP;
  
  RETURN ended_count;
END;
$function$;

-- Create a function to clean up old ended streams (optional - keeps database clean)
CREATE OR REPLACE FUNCTION public.cleanup_old_streams(days_old integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete streams that ended more than specified days ago
  DELETE FROM public.streams
  WHERE 
    is_live = false
    AND ended_at IS NOT NULL
    AND ended_at < now() - make_interval(days => days_old);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$function$;