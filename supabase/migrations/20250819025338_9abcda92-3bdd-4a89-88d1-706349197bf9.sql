-- Add automatic stream cleanup function that runs periodically
CREATE OR REPLACE FUNCTION public.cleanup_inactive_streams()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  cleaned_count integer;
BEGIN
  -- End streams that haven't had a heartbeat in the last 2 minutes and mark them as not live
  UPDATE public.streams
  SET 
    is_live = false,
    ended_at = COALESCE(ended_at, now())
  WHERE 
    is_live = true
    AND (
      last_heartbeat IS NULL 
      OR last_heartbeat < now() - interval '2 minutes'
    );
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  -- Delete streams that have been ended for more than 24 hours and don't have a playback_url (no VOD)
  DELETE FROM public.streams
  WHERE 
    is_live = false
    AND ended_at IS NOT NULL
    AND ended_at < now() - interval '24 hours'
    AND playback_url IS NULL;
  
  RETURN cleaned_count;
END;
$$;

-- Create a function to handle user authentication with wallet
CREATE OR REPLACE FUNCTION public.authenticate_wallet_user(
  wallet_address text,
  user_handle text DEFAULT NULL,
  display_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_id uuid;
  existing_profile public.profiles%ROWTYPE;
BEGIN
  -- Generate a deterministic user ID based on wallet address
  user_id := uuid_generate_v5(uuid_ns_url(), wallet_address);
  
  -- Check if profile already exists
  SELECT * INTO existing_profile FROM public.profiles WHERE id = user_id::text;
  
  IF existing_profile.id IS NULL THEN
    -- Create new profile
    INSERT INTO public.profiles (
      id,
      handle,
      display_name,
      kaspa_address,
      created_at,
      updated_at
    ) VALUES (
      user_id::text,
      COALESCE(user_handle, 'user_' || substring(wallet_address from 1 for 8)),
      COALESCE(display_name, 'User ' || substring(wallet_address from 1 for 8)),
      wallet_address,
      now(),
      now()
    );
  ELSE
    -- Update existing profile
    UPDATE public.profiles 
    SET 
      handle = COALESCE(user_handle, existing_profile.handle),
      display_name = COALESCE(display_name, existing_profile.display_name),
      kaspa_address = wallet_address,
      updated_at = now()
    WHERE id = user_id::text;
  END IF;
  
  RETURN user_id;
END;
$$;

-- Update RLS policies to allow wallet-based operations
DROP POLICY IF EXISTS "Users can insert their own likes" ON public.likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON public.likes;
DROP POLICY IF EXISTS "Users can insert their own follows" ON public.follows;
DROP POLICY IF EXISTS "Users can delete their own follows" ON public.follows;

-- More flexible policies that work with wallet authentication
CREATE POLICY "Authenticated users can insert likes" 
ON public.likes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can delete their own likes" 
ON public.likes 
FOR DELETE 
USING (true);

CREATE POLICY "Authenticated users can insert follows" 
ON public.follows 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can delete their own follows" 
ON public.follows 
FOR DELETE 
USING (true);