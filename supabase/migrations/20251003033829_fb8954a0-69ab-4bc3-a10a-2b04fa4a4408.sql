-- Create function to update browser stream heartbeat using session token
CREATE OR REPLACE FUNCTION public.update_browser_stream_heartbeat(
  session_token_param text,
  wallet_address_param text,
  stream_id_param uuid,
  is_live_param boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  encrypted_user_id TEXT;
BEGIN
  -- Validate session token
  SELECT s.encrypted_user_id INTO encrypted_user_id
  FROM public.wallet_auth_sessions s
  WHERE s.session_token = session_token_param
    AND s.wallet_address = wallet_address_param
    AND s.is_active = true
    AND s.expires_at > now();
  
  IF encrypted_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired session token';
  END IF;
  
  -- Verify the stream belongs to this user
  IF NOT EXISTS (
    SELECT 1 FROM public.streams 
    WHERE id = stream_id_param 
    AND user_id = encrypted_user_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Stream does not belong to this user';
  END IF;
  
  -- Update stream heartbeat and live status
  UPDATE public.streams
  SET 
    is_live = is_live_param,
    last_heartbeat = now(),
    stream_type = 'browser'
  WHERE id = stream_id_param;
  
  -- Update session last used
  UPDATE public.wallet_auth_sessions
  SET last_used_at = now()
  WHERE session_token = session_token_param;
END;
$$;