-- Create a table to track active viewers with unique sessions
CREATE TABLE public.stream_viewers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  user_id TEXT,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(stream_id, session_id)
);

-- Enable Row Level Security
ALTER TABLE public.stream_viewers ENABLE ROW LEVEL SECURITY;

-- Create policies for viewer tracking
CREATE POLICY "Anyone can view stream viewers" 
ON public.stream_viewers 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their viewer session" 
ON public.stream_viewers 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their viewer session" 
ON public.stream_viewers 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete their viewer session" 
ON public.stream_viewers 
FOR DELETE 
USING (true);

-- Function to join as viewer with unique session
CREATE OR REPLACE FUNCTION public.join_stream_viewer(
  stream_id_param UUID,
  session_id_param TEXT,
  user_id_param TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert or update viewer session
  INSERT INTO public.stream_viewers (stream_id, session_id, user_id, joined_at, last_heartbeat)
  VALUES (stream_id_param, session_id_param, user_id_param, now(), now())
  ON CONFLICT (stream_id, session_id)
  DO UPDATE SET
    last_heartbeat = now(),
    user_id = COALESCE(EXCLUDED.user_id, stream_viewers.user_id);
    
  -- Update stream viewer count
  UPDATE public.streams
  SET viewers = (
    SELECT COUNT(DISTINCT session_id)
    FROM public.stream_viewers
    WHERE stream_id = stream_id_param
    AND last_heartbeat > now() - interval '2 minutes'
  )
  WHERE id = stream_id_param;
END;
$function$;

-- Function to leave as viewer
CREATE OR REPLACE FUNCTION public.leave_stream_viewer(
  stream_id_param UUID,
  session_id_param TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Remove viewer session
  DELETE FROM public.stream_viewers
  WHERE stream_id = stream_id_param AND session_id = session_id_param;
  
  -- Update stream viewer count
  UPDATE public.streams
  SET viewers = (
    SELECT COUNT(DISTINCT session_id)
    FROM public.stream_viewers
    WHERE stream_id = stream_id_param
    AND last_heartbeat > now() - interval '2 minutes'
  )
  WHERE id = stream_id_param;
END;
$function$;

-- Function to update viewer heartbeat
CREATE OR REPLACE FUNCTION public.update_viewer_heartbeat(
  stream_id_param UUID,
  session_id_param TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update heartbeat
  UPDATE public.stream_viewers
  SET last_heartbeat = now()
  WHERE stream_id = stream_id_param AND session_id = session_id_param;
  
  -- Update stream viewer count (remove stale viewers)
  UPDATE public.streams
  SET viewers = (
    SELECT COUNT(DISTINCT session_id)
    FROM public.stream_viewers
    WHERE stream_id = stream_id_param
    AND last_heartbeat > now() - interval '2 minutes'
  )
  WHERE id = stream_id_param;
END;
$function$;

-- Function to clean up stale viewers
CREATE OR REPLACE FUNCTION public.cleanup_stale_viewers()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Remove viewers who haven't sent heartbeat in 2 minutes
  DELETE FROM public.stream_viewers
  WHERE last_heartbeat < now() - interval '2 minutes';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Update all stream viewer counts
  UPDATE public.streams
  SET viewers = (
    SELECT COUNT(DISTINCT sv.session_id)
    FROM public.stream_viewers sv
    WHERE sv.stream_id = streams.id
    AND sv.last_heartbeat > now() - interval '2 minutes'
  );
  
  RETURN deleted_count;
END;
$function$;

-- Enable realtime for stream_viewers table
ALTER TABLE public.stream_viewers REPLICA IDENTITY FULL;