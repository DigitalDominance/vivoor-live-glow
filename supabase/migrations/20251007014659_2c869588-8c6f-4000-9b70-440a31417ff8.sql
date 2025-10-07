-- Create secure function to end browser streams
-- Only the wallet-authenticated stream owner can end their stream
CREATE OR REPLACE FUNCTION public.end_browser_stream_secure(
  session_token_param text,
  wallet_address_param text,
  stream_id_param uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encrypted_user_id TEXT;
BEGIN
  -- Validate session token and get encrypted user ID
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
    RAISE EXCEPTION 'Unauthorized: You can only end your own streams';
  END IF;
  
  -- Mark stream as not live
  UPDATE public.streams
  SET 
    is_live = false,
    ended_at = COALESCE(ended_at, now())
  WHERE id = stream_id_param
    AND user_id = encrypted_user_id;
  
  -- Update session last used
  UPDATE public.wallet_auth_sessions
  SET last_used_at = now()
  WHERE session_token = session_token_param;
END;
$$;