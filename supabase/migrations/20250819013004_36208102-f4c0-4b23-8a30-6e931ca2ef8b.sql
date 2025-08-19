-- Fix the typo in the trigger function for VOD creation
-- The trigger was using NEW.playbook_url instead of NEW.playback_url

CREATE OR REPLACE FUNCTION public.create_vod_from_stream()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only create VOD if stream is being marked as ended and it was live for more than 30 seconds
  IF NEW.is_live = false AND OLD.is_live = true AND NEW.playback_url IS NOT NULL THEN
    -- Check if stream was live for at least 30 seconds
    IF EXTRACT(EPOCH FROM (COALESCE(NEW.ended_at, now()) - NEW.started_at)) >= 30 THEN
      INSERT INTO public.vods (
        user_id,
        title,
        src_url,
        thumbnail_url,
        duration_seconds,
        category,
        description
      ) VALUES (
        NEW.user_id,
        NEW.title || ' - Live Stream',
        NEW.playback_url, -- Fixed: was NEW.playbook_url
        NEW.thumbnail_url,
        EXTRACT(EPOCH FROM (COALESCE(NEW.ended_at, now()) - NEW.started_at))::integer,
        NEW.category,
        'Automatically saved from live stream'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;