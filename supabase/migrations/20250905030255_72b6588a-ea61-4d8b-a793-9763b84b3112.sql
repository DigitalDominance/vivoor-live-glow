-- Create the secure authentication function that uses encrypted user IDs
CREATE OR REPLACE FUNCTION public.authenticate_wallet_user_secure(wallet_address text, user_handle text DEFAULT NULL::text, user_display_name text DEFAULT NULL::text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  encrypted_user_id text;
  existing_profile public.profiles%ROWTYPE;
BEGIN
  -- Generate encrypted user ID from wallet address
  encrypted_user_id := encrypt_wallet_address(wallet_address);
  
  -- Check if profile already exists
  SELECT p.* INTO existing_profile 
  FROM public.profiles p 
  WHERE p.id = encrypted_user_id;
  
  IF existing_profile.id IS NULL THEN
    -- Create new profile with encrypted ID
    INSERT INTO public.profiles (
      id,
      handle,
      display_name,
      kaspa_address,
      created_at,
      updated_at
    ) VALUES (
      encrypted_user_id,
      COALESCE(user_handle, 'user_' || substring(encrypted_user_id from 5 for 8)),
      COALESCE(user_display_name, 'User ' || substring(encrypted_user_id from 5 for 8)),
      wallet_address,
      now(),
      now()
    );
  ELSE
    -- Update existing profile
    UPDATE public.profiles 
    SET 
      handle = COALESCE(user_handle, public.profiles.handle),
      display_name = COALESCE(user_display_name, public.profiles.display_name),
      kaspa_address = wallet_address,
      updated_at = now()
    WHERE public.profiles.id = encrypted_user_id;
  END IF;
  
  RETURN encrypted_user_id;
END;
$$;