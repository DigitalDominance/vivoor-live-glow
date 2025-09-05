-- Create secure wallet authentication edge function that requires proper signature verification
-- Remove the vulnerable authenticate_wallet_secure function and replace with secure edge function approach

-- Update the authenticate_wallet_secure function to require edge function verification
CREATE OR REPLACE FUNCTION public.authenticate_wallet_secure(
  wallet_address_param TEXT,
  message_param TEXT,
  signature_param TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- This function should only be called from the secure edge function
  -- Regular users should not be able to call this directly
  IF current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: This function can only be called from secure edge functions';
  END IF;
  
  DECLARE
    encrypted_user_id TEXT;
    existing_profile public.profiles%ROWTYPE;
  BEGIN
    -- Generate encrypted user ID from wallet address
    encrypted_user_id := encrypt_wallet_address(wallet_address_param);
    
    -- Check if profile already exists
    SELECT p.* INTO existing_profile 
    FROM public.profiles p 
    WHERE p.id = encrypted_user_id;
    
    IF existing_profile.id IS NULL THEN
      -- Create new profile with encrypted ID and REAL wallet address
      INSERT INTO public.profiles (
        id,
        handle,
        display_name,
        kaspa_address,
        created_at,
        updated_at
      ) VALUES (
        encrypted_user_id,
        'user_' || substring(encrypted_user_id from 5 for 8),
        'User ' || substring(encrypted_user_id from 5 for 8),
        wallet_address_param, -- Store the REAL wallet address, not encrypted
        now(),
        now()
      );
    ELSE
      -- Update existing profile with REAL wallet address
      UPDATE public.profiles 
      SET 
        kaspa_address = wallet_address_param, -- Store the REAL wallet address
        updated_at = now()
      WHERE id = encrypted_user_id;
    END IF;
    
    RETURN encrypted_user_id;
  END;
END;
$$;

-- Create a session management function for the edge function
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
BEGIN
  -- This function should only be called from the secure edge function
  IF current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: This function can only be called from secure edge functions';
  END IF;
  
  -- Generate secure session token
  session_token := encode(gen_random_bytes(32), 'hex');
  
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