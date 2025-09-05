-- Create secure JWT-based authentication for wallet connections

-- Create a secure table to store wallet authentication sessions
CREATE TABLE public.wallet_auth_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  encrypted_user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS on wallet auth sessions
ALTER TABLE public.wallet_auth_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for wallet auth sessions
CREATE POLICY "Users can view their own auth sessions" 
ON public.wallet_auth_sessions 
FOR SELECT 
USING (encrypted_user_id = (auth.uid())::text);

CREATE POLICY "System can manage auth sessions" 
ON public.wallet_auth_sessions 
FOR ALL 
USING (true);

-- Create function to generate secure wallet JWT
CREATE OR REPLACE FUNCTION public.generate_wallet_jwt(
  wallet_address_param TEXT,
  encrypted_user_id_param TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  session_token TEXT;
  expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Generate a secure session token (UUID-based)
  session_token := gen_random_uuid()::text || '_' || extract(epoch from now())::text;
  
  -- Set expiration to 30 days from now
  expires_at := now() + interval '30 days';
  
  -- Insert the session
  INSERT INTO public.wallet_auth_sessions (
    encrypted_user_id,
    wallet_address,
    session_token,
    expires_at
  ) VALUES (
    encrypted_user_id_param,
    wallet_address_param,
    session_token,
    expires_at
  );
  
  RETURN session_token;
END;
$$;

-- Create function to verify wallet JWT
CREATE OR REPLACE FUNCTION public.verify_wallet_jwt(
  session_token_param TEXT,
  wallet_address_param TEXT
) RETURNS TABLE(
  is_valid BOOLEAN,
  encrypted_user_id TEXT,
  expires_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (was.expires_at > now() AND was.is_active) as is_valid,
    was.encrypted_user_id,
    was.expires_at
  FROM public.wallet_auth_sessions was
  WHERE was.session_token = session_token_param
    AND was.wallet_address = wallet_address_param
  LIMIT 1;
END;
$$;

-- Create function to refresh wallet session
CREATE OR REPLACE FUNCTION public.refresh_wallet_session(
  session_token_param TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.wallet_auth_sessions
  SET 
    last_used_at = now(),
    expires_at = now() + interval '30 days'
  WHERE session_token = session_token_param
    AND expires_at > now()
    AND is_active = true;
END;
$$;

-- Create function to invalidate wallet session
CREATE OR REPLACE FUNCTION public.invalidate_wallet_session(
  session_token_param TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.wallet_auth_sessions
  SET is_active = false
  WHERE session_token = session_token_param;
END;
$$;

-- Update profile functions to require JWT verification
CREATE OR REPLACE FUNCTION public.update_username_secure(
  session_token_param TEXT,
  wallet_address_param TEXT,
  new_username TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  auth_result RECORD;
  can_change BOOLEAN;
  cooldown_ends TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Verify the JWT session
  SELECT * INTO auth_result 
  FROM public.verify_wallet_jwt(session_token_param, wallet_address_param);
  
  IF NOT auth_result.is_valid THEN
    RAISE EXCEPTION 'Invalid or expired session token';
  END IF;
  
  -- Check if user can change username
  SELECT cc.can_change, cc.cooldown_ends_at INTO can_change, cooldown_ends
  FROM public.can_change_username(auth_result.encrypted_user_id) cc;
  
  IF NOT can_change THEN
    RAISE EXCEPTION 'Username can only be changed once every 14 days. Next change available at: %', cooldown_ends;
  END IF;
  
  -- Check if username is already taken
  IF EXISTS (SELECT 1 FROM public.profiles WHERE handle = new_username AND id != auth_result.encrypted_user_id) THEN
    RAISE EXCEPTION 'Username is already taken';
  END IF;
  
  -- Update username
  UPDATE public.profiles
  SET 
    handle = new_username,
    display_name = new_username,
    last_username_change = now(),
    updated_at = now()
  WHERE id = auth_result.encrypted_user_id;
  
  -- Refresh the session
  PERFORM public.refresh_wallet_session(session_token_param);
END;
$$;

-- Create secure avatar update function
CREATE OR REPLACE FUNCTION public.update_avatar_secure(
  session_token_param TEXT,
  wallet_address_param TEXT,
  new_avatar_url TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  auth_result RECORD;
  can_change BOOLEAN;
  cooldown_ends TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Verify the JWT session
  SELECT * INTO auth_result 
  FROM public.verify_wallet_jwt(session_token_param, wallet_address_param);
  
  IF NOT auth_result.is_valid THEN
    RAISE EXCEPTION 'Invalid or expired session token';
  END IF;
  
  -- Check if user can change avatar
  SELECT cc.can_change, cc.cooldown_ends_at INTO can_change, cooldown_ends
  FROM public.can_change_avatar(auth_result.encrypted_user_id) cc;
  
  IF NOT can_change THEN
    RAISE EXCEPTION 'Avatar can only be changed once every 24 hours. Next change available at: %', cooldown_ends;
  END IF;
  
  -- Update avatar
  UPDATE public.profiles
  SET 
    avatar_url = new_avatar_url,
    last_avatar_change = now(),
    updated_at = now()
  WHERE id = auth_result.encrypted_user_id;
  
  -- Refresh the session
  PERFORM public.refresh_wallet_session(session_token_param);
END;
$$;

-- Create secure bio update function  
CREATE OR REPLACE FUNCTION public.update_bio_secure(
  session_token_param TEXT,
  wallet_address_param TEXT,
  new_bio TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  auth_result RECORD;
BEGIN
  -- Verify the JWT session
  SELECT * INTO auth_result 
  FROM public.verify_wallet_jwt(session_token_param, wallet_address_param);
  
  IF NOT auth_result.is_valid THEN
    RAISE EXCEPTION 'Invalid or expired session token';
  END IF;
  
  -- Update bio
  UPDATE public.profiles
  SET 
    bio = new_bio,
    updated_at = now()
  WHERE id = auth_result.encrypted_user_id;
  
  -- Refresh the session
  PERFORM public.refresh_wallet_session(session_token_param);
END;
$$;

-- Create secure banner update function
CREATE OR REPLACE FUNCTION public.update_banner_secure(
  session_token_param TEXT,
  wallet_address_param TEXT,
  new_banner_url TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  auth_result RECORD;
BEGIN
  -- Verify the JWT session
  SELECT * INTO auth_result 
  FROM public.verify_wallet_jwt(session_token_param, wallet_address_param);
  
  IF NOT auth_result.is_valid THEN
    RAISE EXCEPTION 'Invalid or expired session token';
  END IF;
  
  -- Update banner
  UPDATE public.profiles
  SET 
    banner_url = new_banner_url,
    updated_at = now()
  WHERE id = auth_result.encrypted_user_id;
  
  -- Refresh the session
  PERFORM public.refresh_wallet_session(session_token_param);
END;
$$;