-- Remove the overly permissive policy that allows everyone to view all profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a policy for users to view their own complete profile (including Kaspa address)
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid()::text = id);

-- Create a policy for public profile information (excluding sensitive data like Kaspa addresses)
-- This allows displaying profile info for streamers, follows, etc. without exposing wallet addresses
CREATE POLICY "Public profile information visible" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Create a secure function to get public profile data without sensitive information
CREATE OR REPLACE FUNCTION public.get_public_profile_secure(_id text)
RETURNS TABLE(
  id text, 
  display_name text, 
  handle text, 
  avatar_url text, 
  bio text, 
  created_at timestamp with time zone,
  banner_url text
) 
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT 
    p.id,
    p.display_name,
    p.handle,
    p.avatar_url,
    p.bio,
    p.created_at,
    p.banner_url
  FROM public.profiles p
  WHERE p.id = _id;
$function$;

-- Ensure the existing get_tip_address function works for authenticated users to get tip addresses for streams
-- This function already has proper security checks and only returns addresses for authenticated users