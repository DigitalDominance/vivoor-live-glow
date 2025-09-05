-- Fix stream authentication and create secure stream creation function

-- First, update RLS policies on streams table to ensure proper authentication
DROP POLICY IF EXISTS "Authenticated users can create their own streams" ON public.streams;
DROP POLICY IF EXISTS "Stream owners can update their own streams" ON public.streams;
DROP POLICY IF EXISTS "Stream owners can delete their own streams" ON public.streams;
DROP POLICY IF EXISTS "Service role full access to streams" ON public.streams;

-- Create secure RLS policies for streams
CREATE POLICY "Authenticated wallet users can create streams" 
ON public.streams 
FOR INSERT 
WITH CHECK (
  user_id IS NOT NULL 
  AND user_id != '' 
  AND EXISTS (
    SELECT 1 FROM public.wallet_auth_sessions 
    WHERE encrypted_user_id = user_id 
    AND is_active = true 
    AND expires_at > now()
  )
);

CREATE POLICY "Stream owners can update their own streams" 
ON public.streams 
FOR UPDATE 
USING (
  user_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.wallet_auth_sessions 
    WHERE encrypted_user_id = user_id 
    AND is_active = true 
    AND expires_at > now()
  )
) 
WITH CHECK (user_id = user_id); -- Prevent changing ownership

CREATE POLICY "Stream owners can delete their own streams" 
ON public.streams 
FOR DELETE 
USING (
  user_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.wallet_auth_sessions 
    WHERE encrypted_user_id = user_id 
    AND is_active = true 
    AND expires_at > now()
  )
);

CREATE POLICY "Streams are viewable by everyone" 
ON public.streams 
FOR SELECT 
USING (true);

CREATE POLICY "Service role full access to streams" 
ON public.streams 
FOR ALL 
USING (current_setting('role', true) = 'service_role') 
WITH CHECK (current_setting('role', true) = 'service_role');

-- Create secure stream creation function that validates JWT tokens
CREATE OR REPLACE FUNCTION public.create_stream_secure(
  session_token_param TEXT,
  wallet_address_param TEXT,
  title_param TEXT,
  category_param TEXT DEFAULT NULL,
  livepeer_stream_id_param TEXT DEFAULT NULL,
  livepeer_playback_id_param TEXT DEFAULT NULL,
  streaming_mode_param TEXT DEFAULT 'rtmp',
  is_live_param BOOLEAN DEFAULT false
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
  
  -- Create the stream
  INSERT INTO public.streams (
    user_id,
    title,
    category,
    livepeer_stream_id,
    livepeer_playback_id,
    streaming_mode,
    is_live,
    last_heartbeat,
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
    now(),
    now()
  ) RETURNING id INTO stream_id;
  
  RETURN stream_id;
END;
$$;

-- Create function to verify wallet JWT tokens
CREATE OR REPLACE FUNCTION public.verify_wallet_jwt(
  session_token_param TEXT,
  wallet_address_param TEXT
) RETURNS TABLE(is_valid BOOLEAN, encrypted_user_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (s.session_token IS NOT NULL AND s.is_active = true AND s.expires_at > now()) as is_valid,
    s.encrypted_user_id
  FROM public.wallet_auth_sessions s
  WHERE s.session_token = session_token_param
    AND s.wallet_address = wallet_address_param
  LIMIT 1;
END;
$$;

-- Create functions for secure profile updates with JWT validation
CREATE OR REPLACE FUNCTION public.update_username_secure(
  session_token_param TEXT,
  wallet_address_param TEXT,
  new_username TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encrypted_user_id TEXT;
  can_change BOOLEAN;
  cooldown_ends TIMESTAMP WITH TIME ZONE;
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
  
  -- Check username change cooldown
  SELECT cc.can_change, cc.cooldown_ends_at INTO can_change, cooldown_ends
  FROM public.can_change_username(encrypted_user_id) cc;
  
  IF NOT can_change THEN
    RAISE EXCEPTION 'Username can only be changed once every 14 days. Next change available at: %', cooldown_ends;
  END IF;
  
  -- Check if username is already taken
  IF EXISTS (SELECT 1 FROM public.profiles WHERE handle = new_username AND id != encrypted_user_id) THEN
    RAISE EXCEPTION 'Username is already taken';
  END IF;
  
  -- Update username
  UPDATE public.profiles
  SET 
    handle = new_username,
    display_name = new_username,
    last_username_change = now(),
    updated_at = now()
  WHERE id = encrypted_user_id;
  
  -- Update session last used
  UPDATE public.wallet_auth_sessions
  SET last_used_at = now()
  WHERE session_token = session_token_param;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_avatar_secure(
  session_token_param TEXT,
  wallet_address_param TEXT,
  new_avatar_url TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encrypted_user_id TEXT;
  can_change BOOLEAN;
  cooldown_ends TIMESTAMP WITH TIME ZONE;
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
  
  -- Check avatar change cooldown
  SELECT cc.can_change, cc.cooldown_ends_at INTO can_change, cooldown_ends
  FROM public.can_change_avatar(encrypted_user_id) cc;
  
  IF NOT can_change THEN
    RAISE EXCEPTION 'Avatar can only be changed once every 24 hours. Next change available at: %', cooldown_ends;
  END IF;
  
  -- Update avatar
  UPDATE public.profiles
  SET 
    avatar_url = new_avatar_url,
    last_avatar_change = now(),
    updated_at = now()
  WHERE id = encrypted_user_id;
  
  -- Update session last used
  UPDATE public.wallet_auth_sessions
  SET last_used_at = now()
  WHERE session_token = session_token_param;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_bio_secure(
  session_token_param TEXT,
  wallet_address_param TEXT,
  new_bio TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  
  -- Update bio
  UPDATE public.profiles
  SET 
    bio = new_bio,
    updated_at = now()
  WHERE id = encrypted_user_id;
  
  -- Update session last used
  UPDATE public.wallet_auth_sessions
  SET last_used_at = now()
  WHERE session_token = session_token_param;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_banner_secure(
  session_token_param TEXT,
  wallet_address_param TEXT,
  new_banner_url TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  
  -- Update banner
  UPDATE public.profiles
  SET 
    banner_url = new_banner_url,
    updated_at = now()
  WHERE id = encrypted_user_id;
  
  -- Update session last used
  UPDATE public.wallet_auth_sessions
  SET last_used_at = now()
  WHERE session_token = session_token_param;
END;
$$;

-- Function to invalidate wallet sessions
CREATE OR REPLACE FUNCTION public.invalidate_wallet_session(
  session_token_param TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.wallet_auth_sessions
  SET is_active = false
  WHERE session_token = session_token_param;
END;
$$;