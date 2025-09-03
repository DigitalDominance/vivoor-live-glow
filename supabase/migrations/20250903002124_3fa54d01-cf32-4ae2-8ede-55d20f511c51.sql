-- Drop the problematic view
DROP VIEW IF EXISTS public.public_profiles;

-- Create a better approach: update existing database functions to handle safe public profile access
-- Update the get_public_profile_secure function to exclude sensitive data
CREATE OR REPLACE FUNCTION public.get_public_profile_safe(_id text)
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
AS $$
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
$$;