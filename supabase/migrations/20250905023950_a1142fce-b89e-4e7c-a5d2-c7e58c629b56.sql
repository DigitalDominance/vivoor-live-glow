-- Create a function to verify profile ownership
CREATE OR REPLACE FUNCTION public.verify_profile_ownership(user_id_param text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id_param = (auth.uid())::text;
$$;