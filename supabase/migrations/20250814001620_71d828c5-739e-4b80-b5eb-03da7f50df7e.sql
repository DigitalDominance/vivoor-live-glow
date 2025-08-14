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

-- Update user_id columns to accept text instead of UUID since we use Kaspa addresses
ALTER TABLE public.streams ALTER COLUMN user_id TYPE text;
ALTER TABLE public.profiles ALTER COLUMN id TYPE text;
ALTER TABLE public.vods ALTER COLUMN user_id TYPE text;
ALTER TABLE public.clips ALTER COLUMN user_id TYPE text;

-- Recreate RLS policies with text comparison
-- Streams policies
CREATE POLICY "Users can insert their own streams" 
ON public.streams 
FOR INSERT 
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own streams" 
ON public.streams 
FOR UPDATE 
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own streams" 
ON public.streams 
FOR DELETE 
USING (auth.uid()::text = user_id);

-- Profiles policies  
CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid()::text = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid()::text = id)
WITH CHECK (auth.uid()::text = id);

CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid()::text = id);

-- VODs policies
CREATE POLICY "Users can insert their own VODs" 
ON public.vods 
FOR INSERT 
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own VODs" 
ON public.vods 
FOR UPDATE 
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own VODs" 
ON public.vods 
FOR DELETE 
USING (auth.uid()::text = user_id);

-- Clips policies
CREATE POLICY "Users can insert their own clips" 
ON public.clips 
FOR INSERT 
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own clips" 
ON public.clips 
FOR UPDATE 
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own clips" 
ON public.clips 
FOR DELETE 
USING (auth.uid()::text = user_id);

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  RETURN (
    SELECT kaspa_address FROM public.profiles WHERE id = _id LIMIT 1
  );
END;
$function$;