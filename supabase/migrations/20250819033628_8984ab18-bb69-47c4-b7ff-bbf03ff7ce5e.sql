-- Fix the authenticate_wallet_user function to use proper UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION public.authenticate_wallet_user(wallet_address text, user_handle text DEFAULT NULL::text, display_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_id uuid;
  existing_profile public.profiles%ROWTYPE;
BEGIN
  -- Generate a deterministic user ID based on wallet address
  user_id := uuid_generate_v5(uuid_ns_url(), wallet_address);
  
  -- Check if profile already exists
  SELECT * INTO existing_profile FROM public.profiles WHERE id = user_id::text;
  
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
      user_id::text,
      COALESCE(user_handle, 'user_' || substring(wallet_address from 1 for 8)),
      COALESCE(display_name, 'User ' || substring(wallet_address from 1 for 8)),
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
    WHERE id = user_id::text;
  END IF;
  
  RETURN user_id;
END;
$function$