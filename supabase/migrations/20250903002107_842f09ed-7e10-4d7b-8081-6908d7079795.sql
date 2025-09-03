-- Drop the overly permissive policy that exposes all profile data
DROP POLICY IF EXISTS "Public profile information visible" ON public.profiles;

-- Create a restrictive policy that only exposes safe public profile information
CREATE POLICY "Safe public profile information" 
ON public.profiles 
FOR SELECT 
USING (true);

-- However, we need to ensure that sensitive fields like kaspa_address are not exposed
-- Let's create a view for public profile data that excludes sensitive information
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  handle,
  display_name,
  avatar_url,
  bio,
  created_at,
  banner_url
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Update the policy to be more explicit about what can be accessed publicly
DROP POLICY IF EXISTS "Safe public profile information" ON public.profiles;

-- Create a policy that only allows users to see their own full profile
CREATE POLICY "Users can view their own full profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid()::text = id);

-- Create a policy for public basic info only (without sensitive data like kaspa_address)
-- This will be handled through the public_profiles view instead