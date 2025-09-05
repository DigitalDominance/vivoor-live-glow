-- Update create_wallet_session to use a different secure token generation method
CREATE OR REPLACE FUNCTION public.create_wallet_session(
  encrypted_user_id TEXT,
  wallet_address TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  session_token TEXT;
  uuid_val TEXT;
  timestamp_val TEXT;
BEGIN
  -- This function should only be called from the secure edge function
  IF current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: This function can only be called from secure edge functions';
  END IF;
  
  -- Generate secure session token using UUID and timestamp
  uuid_val := replace(gen_random_uuid()::text, '-', '');
  timestamp_val := extract(epoch from now())::bigint::text;
  session_token := 'wallet_' || timestamp_val || '_' || uuid_val;
  
  -- Create session record
  INSERT INTO public.wallet_auth_sessions (
    encrypted_user_id,
    wallet_address,
    session_token,
    expires_at,
    created_at,
    last_used_at,
    is_active
  ) VALUES (
    encrypted_user_id,
    wallet_address,
    session_token,
    now() + interval '30 days',
    now(),
    now(),
    true
  );
  
  RETURN session_token;
END;
$$;