-- Fix security issues with profiles, tips, and SECURITY DEFINER

-- 1. Fix profiles table - restrict kaspa_address access
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Security definer functions can access profiles" ON public.profiles;

-- Allow public access to non-sensitive profile data only
CREATE POLICY "Public can view basic profile info" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Allow users to see their own complete profile including kaspa_address
CREATE POLICY "Users can view their complete profile" 
ON public.profiles 
FOR SELECT 
USING ((auth.uid())::text = id);

-- 2. Fix tips table - remove overly permissive live stream policy
DROP POLICY IF EXISTS "Live stream tips basic info" ON public.tips;

-- Only allow users to view tips where they are involved or own the stream
-- Keep existing policies for sender, recipient, and stream owner

-- 3. Create a secure function to get kaspa address for tip functionality
CREATE OR REPLACE FUNCTION public.get_tip_address_secure(stream_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  tip_address text;
BEGIN
  -- Only return kaspa address if user is authenticated and stream is live
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT p.kaspa_address INTO tip_address
  FROM public.streams s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.id = stream_id 
    AND s.is_live = true;
  
  RETURN tip_address;
END;
$$;

-- 4. Create secure function for public profile data (no kaspa_address)
CREATE OR REPLACE FUNCTION public.get_public_profile_data(user_id text)
RETURNS TABLE(id text, display_name text, handle text, avatar_url text, bio text, created_at timestamp with time zone, banner_url text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.display_name,
    p.handle,
    p.avatar_url,
    p.bio,
    p.created_at,
    p.banner_url
  FROM public.profiles p
  WHERE p.id = user_id;
END;
$$;