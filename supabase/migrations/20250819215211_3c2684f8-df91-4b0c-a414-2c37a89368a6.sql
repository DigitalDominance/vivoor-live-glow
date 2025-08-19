-- Remove VOD creation trigger and function with CASCADE to handle dependencies
DROP TRIGGER IF EXISTS create_vod_from_ended_stream ON public.streams CASCADE;
DROP FUNCTION IF EXISTS public.create_vod_from_stream() CASCADE;

-- Clean up old ended streams more aggressively to reduce storage
UPDATE public.streams 
SET is_live = false, ended_at = COALESCE(ended_at, now())
WHERE is_live = true 
  AND (last_heartbeat IS NULL OR last_heartbeat < now() - interval '2 minutes');

-- Delete old ended streams immediately (don't keep them)
DELETE FROM public.streams 
WHERE is_live = false 
  AND ended_at IS NOT NULL 
  AND ended_at < now() - interval '1 day';

-- Update the cleanup function to be more aggressive (1 day instead of 7)
CREATE OR REPLACE FUNCTION public.cleanup_old_streams(days_old integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete streams that ended more than specified days ago (default 1 day)
  DELETE FROM public.streams
  WHERE 
    is_live = false
    AND ended_at IS NOT NULL
    AND ended_at < now() - make_interval(days => days_old);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$function$;