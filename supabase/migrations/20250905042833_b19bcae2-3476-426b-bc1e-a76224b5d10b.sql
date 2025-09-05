-- Update wallet JWT functions to work securely with new RLS policies
-- The functions need SECURITY DEFINER to bypass RLS restrictions for legitimate operations

-- Update verify_wallet_jwt to ensure it works with new security policies
CREATE OR REPLACE FUNCTION public.verify_wallet_jwt(session_token_param text, wallet_address_param text)
RETURNS TABLE(is_valid boolean, encrypted_user_id text, expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- This function bypasses RLS to allow legitimate session validation
  -- It's secure because it requires both session_token AND wallet_address to match
  RETURN QUERY
  SELECT 
    (was.expires_at > now() AND was.is_active) as is_valid,
    was.encrypted_user_id,
    was.expires_at
  FROM public.wallet_auth_sessions was
  WHERE was.session_token = session_token_param
    AND was.wallet_address = wallet_address_param
    AND was.is_active = true
    AND was.expires_at > now()
  LIMIT 1;
END;
$$;

-- Update generate_wallet_jwt to ensure secure session creation
CREATE OR REPLACE FUNCTION public.generate_wallet_jwt(wallet_address_param text, encrypted_user_id_param text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  session_token TEXT;
  expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Generate a secure session token (UUID-based with timestamp)
  session_token := gen_random_uuid()::text || '_' || extract(epoch from now())::text;
  
  -- Set expiration to 30 days from now
  expires_at := now() + interval '30 days';
  
  -- Insert the session (this bypasses RLS due to SECURITY DEFINER)
  INSERT INTO public.wallet_auth_sessions (
    encrypted_user_id,
    wallet_address,
    session_token,
    expires_at,
    is_active
  ) VALUES (
    encrypted_user_id_param,
    wallet_address_param,
    session_token,
    expires_at,
    true
  );
  
  RETURN session_token;
END;
$$;

-- Add comments for security documentation
COMMENT ON FUNCTION public.verify_wallet_jwt IS 'SECURE: Validates wallet sessions using SECURITY DEFINER to bypass RLS safely';
COMMENT ON FUNCTION public.generate_wallet_jwt IS 'SECURE: Creates wallet sessions using SECURITY DEFINER for legitimate auth operations';