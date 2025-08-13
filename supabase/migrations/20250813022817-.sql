-- Tighten profiles visibility and expose safe accessors

-- 1) Drop overly broad public SELECT policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- 2) Ensure owners can still read their own full profile
CREATE POLICY IF NOT EXISTS "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- 3) Create a SECURITY DEFINER function to expose ONLY non-sensitive public profile fields
CREATE OR REPLACE FUNCTION public.get_public_profile(_id uuid)
RETURNS TABLE (
  id uuid,
  display_name text,
  handle text,
  avatar_url text,
  bio text,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
  SELECT p.id, p.display_name, p.handle, p.avatar_url, p.bio, p.created_at, p.updated_at
  FROM public.profiles p
  WHERE p.id = _id
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 4) Create a SECURITY DEFINER function to fetch kaspa_address only for authenticated users
CREATE OR REPLACE FUNCTION public.get_kaspa_address(_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  RETURN (
    SELECT kaspa_address FROM public.profiles WHERE id = _id LIMIT 1
  );
END;
$$;

-- Notes:
-- - SECURITY DEFINER functions run with the privileges of their owner and bypass RLS on tables they access.
-- - We intentionally expose only non-sensitive columns publicly via get_public_profile.
-- - Access to kaspa_address requires an authenticated session via get_kaspa_address.
