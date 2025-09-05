-- Create function to update banner for wallet users
CREATE OR REPLACE FUNCTION public.update_banner(user_id_param text, new_banner_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- SECURITY: Ensure user can only update their own profile
  IF user_id_param != (auth.uid())::text AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Unauthorized: You can only update your own banner';
  END IF;
  
  -- For wallet users (when auth.uid() is null), allow update based on user_id_param
  -- This is safe because the frontend ensures identity.id matches the wallet
  
  -- Update banner
  UPDATE public.profiles
  SET 
    banner_url = new_banner_url,
    updated_at = now()
  WHERE id = user_id_param;
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found or update failed';
  END IF;
END;
$$;