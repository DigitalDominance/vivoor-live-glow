-- Update monitor_livepeer_streams to use 3-minute timeout for browser streams
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
    RAISE LOG 'Auto-ending disconnected RTMP stream: % (user: %, title: %, type: %)', 
      stream_record.id, stream_record.user_id, stream_record.title, stream_record.stream_type;
    
    UPDATE public.streams
    SET 
      is_live = false,
      ended_at = COALESCE(ended_at, now())
    WHERE id = stream_record.id;
    
    ended_count := ended_count + 1;
  END LOOP;
  
  -- Handle browser streams with 3 MINUTE timeout (much longer than RTMP)
  FOR stream_record IN
    SELECT id, user_id, title
    FROM public.streams
    WHERE is_live = true
    AND stream_type = 'browser'
    AND (
      last_heartbeat IS NULL 
      OR last_heartbeat < now() - interval '3 minutes'
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