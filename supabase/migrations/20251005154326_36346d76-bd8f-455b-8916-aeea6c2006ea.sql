-- Update monitor_livepeer_streams to only affect RTMP streams, not browser streams
CREATE OR REPLACE FUNCTION public.monitor_livepeer_streams()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ended_count integer := 0;
  stream_record RECORD;
BEGIN
  -- Get all live RTMP streams (not browser streams) that haven't sent a heartbeat in the last minute
  FOR stream_record IN
    SELECT id, user_id, title, stream_type
    FROM public.streams
    WHERE is_live = true
    AND (stream_type = 'livepeer' OR stream_type IS NULL OR stream_type = 'rtmp') -- Only RTMP streams
    AND stream_type != 'browser' -- Explicitly exclude browser streams
    AND (
      last_heartbeat IS NULL 
      OR last_heartbeat < now() - interval '1 minute'
    )
  LOOP
    -- Log the stream being ended
    RAISE LOG 'Auto-ending disconnected RTMP stream: % (user: %, title: %, type: %)', 
      stream_record.id, stream_record.user_id, stream_record.title, stream_record.stream_type;
    
    -- End the stream
    UPDATE public.streams
    SET 
      is_live = false,
      ended_at = COALESCE(ended_at, now())
    WHERE id = stream_record.id;
    
    ended_count := ended_count + 1;
  END LOOP;
  
  -- Separately handle browser streams with a longer timeout (2 minutes instead of 1)
  FOR stream_record IN
    SELECT id, user_id, title
    FROM public.streams
    WHERE is_live = true
    AND stream_type = 'browser'
    AND (
      last_heartbeat IS NULL 
      OR last_heartbeat < now() - interval '2 minutes'
    )
  LOOP
    RAISE LOG 'Auto-ending disconnected browser stream: % (user: %, title: %)', 
      stream_record.id, stream_record.user_id, stream_record.title;
    
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

-- Update auto_end_disconnected_streams to also respect stream type
CREATE OR REPLACE FUNCTION public.auto_end_disconnected_streams(timeout_minutes integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ended_count integer;
BEGIN
  -- End RTMP streams that haven't had a heartbeat in the specified timeout
  -- Browser streams have separate monitoring with update_browser_stream_heartbeat
  UPDATE public.streams
  SET 
    is_live = false,
    ended_at = COALESCE(ended_at, now())
  WHERE 
    is_live = true
    AND (stream_type = 'livepeer' OR stream_type IS NULL OR stream_type = 'rtmp')
    AND stream_type != 'browser'
    AND (
      last_heartbeat IS NULL 
      OR last_heartbeat < now() - make_interval(mins => timeout_minutes)
    );
  
  GET DIAGNOSTICS ended_count = ROW_COUNT;
  
  RETURN ended_count;
END;
$function$;