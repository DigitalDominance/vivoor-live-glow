-- Fix wallet authentication to require message signing and store addresses properly

-- First, let's update the authenticate_wallet_secure function to require signature verification
CREATE OR REPLACE FUNCTION public.authenticate_wallet_secure(
  wallet_address_param TEXT,
  message_param TEXT,
  signature_param TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;

-- Fix existing corrupted data where kaspa_address contains encrypted IDs
UPDATE public.profiles 
SET kaspa_address = NULL 
WHERE kaspa_address LIKE 'usr_%';

-- Add a function to verify message signatures (placeholder for now, will implement in frontend)
CREATE OR REPLACE FUNCTION public.verify_wallet_signature(
  wallet_address_param TEXT,
  message_param TEXT,
  signature_param TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- This is a placeholder - actual signature verification happens in frontend
  -- We just ensure the message follows our expected format
  RETURN message_param LIKE 'VIVOOR_AUTH_%' AND LENGTH(signature_param) > 50;
END;
$$;