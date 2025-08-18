-- Secure profiles: remove broad public select and expose only safe view and targeted RPCs
BEGIN;

-- Drop the overly broad public select policy if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='profiles' AND policyname='Public can view basic profile info'
  ) THEN
    EXECUTE 'DROP POLICY "Public can view basic profile info" ON public.profiles';
  END IF;
END $$;

-- Make sure owners can read/update their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can view their own profile'
  ) THEN
    EXECUTE '
      CREATE POLICY "Users can view their own profile"
      ON public.profiles FOR SELECT
      USING (auth.uid() = id)
    ';
  END IF;
END $$;

-- Create/replace a view for public profile info with only non-sensitive columns
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
SELECT 
  id, handle, display_name, avatar_url, bio, created_at, updated_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Create SECURITY DEFINER function to fetch a stream's tip address (kaspa_address) without exposing entire profiles table
CREATE OR REPLACE FUNCTION public.get_stream_tip_address(_stream_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _addr text;
BEGIN
  SELECT p.kaspa_address INTO _addr
  FROM public.streams s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.id = _stream_id
  LIMIT 1;
  RETURN _addr;
END;
$$;

REVOKE ALL ON FUNCTION public.get_stream_tip_address(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stream_tip_address(uuid) TO anon, authenticated;

-- Stream auto-end: add heartbeat column if missing and helper functions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='streams' AND column_name='last_heartbeat'
  ) THEN
    EXECUTE 'ALTER TABLE public.streams ADD COLUMN last_heartbeat timestamptz';
  END IF;
END $$;

-- Heartbeat function: streamer pings to stay alive
CREATE OR REPLACE FUNCTION public.stream_heartbeat(_stream_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.streams
  SET last_heartbeat = now(), is_live = true
  WHERE id = _stream_id;
END;
$$;

REVOKE ALL ON FUNCTION public.stream_heartbeat(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stream_heartbeat(uuid) TO authenticated;

-- Auto-end function: ends stream if heartbeat older than threshold (default 60s)
CREATE OR REPLACE FUNCTION public.stream_auto_end(_stream_id uuid, _threshold_seconds int DEFAULT 60)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  did_end boolean := false;
BEGIN
  UPDATE public.streams
  SET is_live = false,
      ended_at = COALESCE(ended_at, now())
  WHERE id = _stream_id
    AND is_live = true
    AND (
      last_heartbeat IS NULL OR last_heartbeat < now() - make_interval(secs => _threshold_seconds)
    );

  GET DIAGNOSTICS did_end = ROW_COUNT > 0;
  RETURN did_end;
END;
$$;

REVOKE ALL ON FUNCTION public.stream_auto_end(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stream_auto_end(uuid, int) TO anon, authenticated;

COMMIT;