-- Fix browser stream timeout to match RTMP streams (2 minutes instead of 3)
-- Both RTMP and browser streams send heartbeats every 15 seconds
-- 2 minutes (120 seconds) = 8x the heartbeat interval, giving enough buffer for network issues
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
  -- Get all live RTMP streams (not browser streams) that haven't sent a heartbeat in the last 2 minutes
  -- IMPORTANT: RTMP timeout is 2 minutes (120 seconds) - this gives enough buffer for network issues
  FOR stream_record IN
    SELECT id, user_id, title, stream_type, last_heartbeat
    FROM public.streams
    WHERE is_live = true
    AND (stream_type = 'livepeer' OR stream_type IS NULL OR stream_type = 'rtmp') -- Only RTMP streams
    AND stream_type != 'browser' -- Explicitly exclude browser streams
    AND (
      last_heartbeat IS NULL 
      OR last_heartbeat < now() - interval '2 minutes'
    )
  LOOP
    RAISE LOG 'Auto-ending disconnected RTMP stream: % (user: %, title: %, type: %, last_heartbeat: %)', 
      stream_record.id, stream_record.user_id, stream_record.title, stream_record.stream_type, stream_record.last_heartbeat;
    
    UPDATE public.streams
    SET 
      is_live = false,
      ended_at = COALESCE(ended_at, now())
    WHERE id = stream_record.id;
    
    ended_count := ended_count + 1;
  END LOOP;
  
  -- Handle browser streams with SAME 2 MINUTE timeout as RTMP (they send heartbeats every 15 seconds)
  -- If heartbeats are working properly, we should see updates every 15 seconds
  -- 2 minutes = 120 seconds gives 8x the heartbeat interval as buffer
  FOR stream_record IN
    SELECT id, user_id, title, last_heartbeat
    FROM public.streams
    WHERE is_live = true
    AND stream_type = 'browser'
    AND (
      last_heartbeat IS NULL 
      OR last_heartbeat < now() - interval '2 minutes'
    )
  LOOP
    RAISE LOG 'Auto-ending disconnected browser stream: % (user: %, title: %, last_heartbeat: %)', 
      stream_record.id, stream_record.user_id, stream_record.title, stream_record.last_heartbeat;
    
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