-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.authenticate_wallet_user(text, text, text);

-- Create improved authenticate_wallet_user function
CREATE OR REPLACE FUNCTION public.authenticate_wallet_user(
  wallet_address text, 
  user_handle text DEFAULT NULL, 
  display_name text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_id text;
  existing_profile public.profiles%ROWTYPE;
BEGIN
  -- Use the wallet address as the user ID (simpler approach)
  user_id := wallet_address;
  
  -- Check if profile already exists
  SELECT * INTO existing_profile FROM public.profiles WHERE id = user_id;
  
  IF existing_profile.id IS NULL THEN
    -- Create new profile
    INSERT INTO public.profiles (
      id,
      handle,
      display_name,
      kaspa_address,
      created_at,
      updated_at
    ) VALUES (
      user_id,
      COALESCE(user_handle, 'user_' || substring(wallet_address from 7 for 8)),
      COALESCE(display_name, 'User ' || substring(wallet_address from 7 for 8)),
      wallet_address,
      now(),
      now()
    );
  ELSE
    -- Update existing profile
    UPDATE public.profiles 
    SET 
      handle = COALESCE(user_handle, existing_profile.handle),
      display_name = COALESCE(display_name, existing_profile.display_name),
      kaspa_address = wallet_address,
      updated_at = now()
    WHERE id = user_id;
  END IF;
  
  RETURN user_id;
END;
$$;