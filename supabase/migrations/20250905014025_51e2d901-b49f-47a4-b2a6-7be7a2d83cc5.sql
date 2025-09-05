-- Create secure viewer count function for public use
CREATE OR REPLACE FUNCTION public.get_stream_viewer_count(stream_id_param uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT session_id)::integer
  FROM public.stream_viewers
  WHERE stream_id = stream_id_param
  AND last_heartbeat > now() - interval '2 minutes';
$$;

-- Function for stream owners to get viewer details for their streams
CREATE OR REPLACE FUNCTION public.get_stream_viewers_for_owner(stream_id_param uuid)
RETURNS TABLE(
  session_id text,
  user_id text,
  joined_at timestamp with time zone,
  last_heartbeat timestamp with time zone
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow stream owners to see viewer details
  IF NOT EXISTS (
    SELECT 1 FROM public.streams s 
    WHERE s.id = stream_id_param 
    AND s.user_id = auth.uid()::text
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You can only view viewers for your own streams';
  END IF;
  
  RETURN QUERY
  SELECT 
    sv.session_id,
    sv.user_id,
    sv.joined_at,
    sv.last_heartbeat
  FROM public.stream_viewers sv
  WHERE sv.stream_id = stream_id_param
  AND sv.last_heartbeat > now() - interval '2 minutes'
  ORDER BY sv.joined_at DESC;
END;
$$;