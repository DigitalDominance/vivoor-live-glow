-- Update user_id columns to accept text instead of UUID since we use Kaspa addresses
ALTER TABLE public.streams ALTER COLUMN user_id TYPE text;
ALTER TABLE public.profiles ALTER COLUMN id TYPE text;
ALTER TABLE public.vods ALTER COLUMN user_id TYPE text;
ALTER TABLE public.clips ALTER COLUMN user_id TYPE text;

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