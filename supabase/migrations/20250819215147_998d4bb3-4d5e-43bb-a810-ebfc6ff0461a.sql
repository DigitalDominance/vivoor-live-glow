-- Remove VOD creation trigger and function to prevent storage costs
DROP TRIGGER IF EXISTS create_vod_from_stream_trigger ON public.streams;
DROP FUNCTION IF EXISTS public.create_vod_from_stream();

-- Update streams table to remove recording-related functionality
-- Keep playback_url for live streaming but no automatic VOD creation
ALTER TABLE public.streams 
DROP COLUMN IF EXISTS treasury_txid,
DROP COLUMN IF EXISTS treasury_block_time;

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

-- Update the cleanup function to be more aggressive
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