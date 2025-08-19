-- Fix the authenticate_wallet_user function with fully qualified column names
DROP FUNCTION IF EXISTS public.authenticate_wallet_user(text, text, text);

CREATE OR REPLACE FUNCTION public.authenticate_wallet_user(
  wallet_address text, 
  user_handle text DEFAULT NULL::text, 
  user_display_name text DEFAULT NULL::text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_id text;
  existing_profile public.profiles%ROWTYPE;
BEGIN
  -- Use the wallet address as the user ID
  user_id := wallet_address;
  
  -- Check if profile already exists
  SELECT p.* INTO existing_profile 
  FROM public.profiles p 
  WHERE p.id = user_id;
  
  IF existing_profile.id IS NULL THEN
    -- Create new profile with fully qualified column names
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
      COALESCE(user_display_name, 'User ' || substring(wallet_address from 7 for 8)),
      wallet_address,
      now(),
      now()
    );
  ELSE
    -- Update existing profile with fully qualified references
    UPDATE public.profiles 
    SET 
      handle = COALESCE(user_handle, public.profiles.handle),
      display_name = COALESCE(user_display_name, public.profiles.display_name),
      kaspa_address = wallet_address,
      updated_at = now()
    WHERE public.profiles.id = user_id;
  END IF;
  
  RETURN user_id;
END;
$function$;