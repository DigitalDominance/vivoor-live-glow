-- Create functions for viewer tracking
CREATE OR REPLACE FUNCTION public.increment_stream_viewers(stream_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.streams
  SET viewers = COALESCE(viewers, 0) + 1
  WHERE id = stream_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_stream_viewers(stream_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.streams
  SET viewers = GREATEST(COALESCE(viewers, 0) - 1, 0)
  WHERE id = stream_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.viewer_heartbeat(stream_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- This function can be used for viewer heartbeat tracking
  -- For now, it's a placeholder that could be extended to track active viewers
  NULL;
END;
$$;

-- Create function to save ended streams as VODs automatically
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
        NEW.playbook_url, -- Use playback URL as VOD source
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

-- Create trigger to automatically save ended streams as VODs
CREATE TRIGGER create_vod_from_ended_stream
  AFTER UPDATE ON public.streams
  FOR EACH ROW
  EXECUTE FUNCTION public.create_vod_from_stream();