-- Add policy to allow public profile lookups by handle for channel pages
CREATE POLICY "Allow public profile lookup by handle" 
ON public.profiles 
FOR SELECT 
USING (handle IS NOT NULL);

-- Ensure the channel lookup can access basic profile info without exposing sensitive data
CREATE OR REPLACE FUNCTION public.get_profile_by_handle(_handle text)
RETURNS TABLE(id text, handle text, display_name text, avatar_url text, bio text, created_at timestamp with time zone, banner_url text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.handle,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.created_at,
    p.banner_url
  FROM public.profiles p
  WHERE p.handle = _handle;
END;
$$;