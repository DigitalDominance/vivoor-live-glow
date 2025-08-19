-- Fix security vulnerability: Restrict kaspa_address access to owner only
-- Update existing policies and create secure functions

-- Drop any existing public access policies  
DROP POLICY IF EXISTS "Public can view basic profile info" ON public.profiles;

-- Create secure function to get public profile info (without kaspa_address)
CREATE OR REPLACE FUNCTION public.get_public_profile_display(user_id text)
RETURNS TABLE(
  id text,
  display_name text,
  handle text,
  avatar_url text,
  bio text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.display_name,
    p.handle,
    p.avatar_url,
    p.bio,
    p.created_at
  FROM public.profiles p
  WHERE p.id = user_id;
$$;

-- Create secure function to get kaspa address for tipping (only for authenticated users)
CREATE OR REPLACE FUNCTION public.get_tip_address(stream_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tip_address text;
BEGIN
  -- Only return kaspa address if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get the kaspa address of the stream owner
  SELECT p.kaspa_address INTO tip_address
  FROM public.streams s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.id = stream_id;
  
  RETURN tip_address;
END;
$$;

-- Create function to auto-end streams after disconnection timeout
CREATE OR REPLACE FUNCTION public.auto_end_disconnected_streams(timeout_minutes integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ended_count integer;
BEGIN
  -- End streams that haven't had a heartbeat in the specified timeout
  UPDATE public.streams
  SET 
    is_live = false,
    ended_at = COALESCE(ended_at, now())
  WHERE 
    is_live = true
    AND (
      last_heartbeat IS NULL 
      OR last_heartbeat < now() - make_interval(mins => timeout_minutes)
    );
  
  GET DIAGNOSTICS ended_count = ROW_COUNT;
  
  RETURN ended_count;
END;
$$;

-- Create function to update stream heartbeat
CREATE OR REPLACE FUNCTION public.update_stream_heartbeat(stream_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow the stream owner to update heartbeat
  IF NOT EXISTS (
    SELECT 1 FROM public.streams 
    WHERE id = stream_id AND user_id = auth.uid()::text
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You can only update your own stream heartbeat';
  END IF;
  
  UPDATE public.streams
  SET last_heartbeat = now()
  WHERE id = stream_id;
END;
$$;