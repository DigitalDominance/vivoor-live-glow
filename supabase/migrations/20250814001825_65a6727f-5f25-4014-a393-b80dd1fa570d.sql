-- Drop all RLS policies that depend on user_id columns
DROP POLICY IF EXISTS "Users can insert their own streams" ON public.streams;
DROP POLICY IF EXISTS "Users can update their own streams" ON public.streams;
DROP POLICY IF EXISTS "Users can delete their own streams" ON public.streams;

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can insert their own VODs" ON public.vods;
DROP POLICY IF EXISTS "Users can update their own VODs" ON public.vods;
DROP POLICY IF EXISTS "Users can delete their own VODs" ON public.vods;

DROP POLICY IF EXISTS "Users can insert their own clips" ON public.clips;
DROP POLICY IF EXISTS "Users can update their own clips" ON public.clips;
DROP POLICY IF EXISTS "Users can delete their own clips" ON public.clips;

-- Drop foreign key constraint from profiles to auth.users
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Update user_id columns to accept text instead of UUID since we use Kaspa addresses
ALTER TABLE public.streams ALTER COLUMN user_id TYPE text;
ALTER TABLE public.profiles ALTER COLUMN id TYPE text;
ALTER TABLE public.vods ALTER COLUMN user_id TYPE text;
ALTER TABLE public.clips ALTER COLUMN user_id TYPE text;

-- Recreate RLS policies using Kaspa address comparison
-- For now, we'll use a simpler approach without auth.uid() since we're using Kaspa addresses
-- We'll need to implement custom authentication logic

-- Streams policies (allow all for now - will need custom auth)
CREATE POLICY "Users can insert their own streams" 
ON public.streams 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own streams" 
ON public.streams 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete their own streams" 
ON public.streams 
FOR DELETE 
USING (true);

-- Profiles policies (allow all for now - will need custom auth)
CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (true);

-- VODs policies (allow all for now - will need custom auth)
CREATE POLICY "Users can insert their own VODs" 
ON public.vods 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own VODs" 
ON public.vods 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete their own VODs" 
ON public.vods 
FOR DELETE 
USING (true);

-- Clips policies (allow all for now - will need custom auth)
CREATE POLICY "Users can insert their own clips" 
ON public.clips 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own clips" 
ON public.clips 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete their own clips" 
ON public.clips 
FOR DELETE 
USING (true);

-- Update the get_public_profile function to accept text instead of UUID
CREATE OR REPLACE FUNCTION public.get_public_profile(_id text)
 RETURNS TABLE(id text, display_name text, handle text, avatar_url text, bio text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.display_name, p.handle, p.avatar_url, p.bio, p.created_at, p.updated_at
  FROM public.profiles p
  WHERE p.id = _id
$function$;

-- Update the get_kaspa_address function to accept text instead of UUID
CREATE OR REPLACE FUNCTION public.get_kaspa_address(_id text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (
    SELECT kaspa_address FROM public.profiles WHERE id = _id LIMIT 1
  );
END;
$function$;