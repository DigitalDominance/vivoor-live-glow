-- Update create_stream_secure function to handle all stream fields in one operation

CREATE OR REPLACE FUNCTION public.create_stream_secure(
  session_token_param TEXT,
  wallet_address_param TEXT,
  title_param TEXT,
  category_param TEXT DEFAULT NULL,
  livepeer_stream_id_param TEXT DEFAULT NULL,
  livepeer_playback_id_param TEXT DEFAULT NULL,
  streaming_mode_param TEXT DEFAULT 'rtmp',
  is_live_param BOOLEAN DEFAULT false,
  playback_url_param TEXT DEFAULT NULL,
  treasury_txid_param TEXT DEFAULT NULL,
  treasury_block_time_param BIGINT DEFAULT NULL,
  stream_type_param TEXT DEFAULT 'livepeer',
  thumbnail_url_param TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encrypted_user_id TEXT;
  stream_id UUID;
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
  
  -- Update last used timestamp for session
  UPDATE public.wallet_auth_sessions
  SET last_used_at = now()
  WHERE session_token = session_token_param;
  
  -- Ensure profile exists
  INSERT INTO public.profiles (id, kaspa_address, handle, display_name, created_at, updated_at)
  VALUES (
    encrypted_user_id,
    wallet_address_param,
    COALESCE((SELECT handle FROM public.profiles WHERE id = encrypted_user_id), 'user_' || substring(encrypted_user_id from 5 for 8)),
    COALESCE((SELECT display_name FROM public.profiles WHERE id = encrypted_user_id), 'User ' || substring(encrypted_user_id from 5 for 8)),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    kaspa_address = wallet_address_param,
    updated_at = now();
  
  -- Create the stream with all fields
  INSERT INTO public.streams (
    user_id,
    title,
    category,
    livepeer_stream_id,
    livepeer_playback_id,
    streaming_mode,
    is_live,
    last_heartbeat,
    playback_url,
    treasury_txid,
    treasury_block_time,
    stream_type,
    thumbnail_url,
    created_at,
    updated_at
  ) VALUES (
    encrypted_user_id,
    title_param,
    category_param,
    livepeer_stream_id_param,
    livepeer_playback_id_param,
    streaming_mode_param,
    is_live_param,
    now(),
    playback_url_param,
    treasury_txid_param,
    treasury_block_time_param,
    stream_type_param,
    thumbnail_url_param,
    now(),
    now()
  ) RETURNING id INTO stream_id;
  
  RETURN stream_id;
END;
$$;