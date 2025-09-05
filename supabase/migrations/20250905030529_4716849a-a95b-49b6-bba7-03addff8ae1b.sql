-- Create wallet_connections table to link authenticated users to wallets
CREATE TABLE public.wallet_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet_address text NOT NULL,
  encrypted_user_id text NOT NULL,
  connected_at timestamp with time zone DEFAULT now() NOT NULL,
  last_used_at timestamp with time zone DEFAULT now() NOT NULL,
  is_primary boolean DEFAULT false NOT NULL,
  UNIQUE(user_id, wallet_address),
  UNIQUE(wallet_address), -- One wallet per account
  UNIQUE(encrypted_user_id) -- One encrypted ID per wallet
);

-- Enable RLS
ALTER TABLE public.wallet_connections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own wallet connections"
ON public.wallet_connections
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own wallet connections"
ON public.wallet_connections
FOR ALL
USING (auth.uid() = user_id);

-- Update profiles table to link to auth.users
ALTER TABLE public.profiles ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX idx_wallet_connections_user_id ON public.wallet_connections(user_id);
CREATE INDEX idx_wallet_connections_wallet_address ON public.wallet_connections(wallet_address);
CREATE INDEX idx_profiles_auth_user_id ON public.profiles(auth_user_id);

-- Update profiles RLS policies to require authentication
DROP POLICY IF EXISTS "Public can view basic profile info" ON public.profiles;
DROP POLICY IF EXISTS "Allow public profile lookup by handle" ON public.profiles;

-- New secure RLS policies that require JWT authentication
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can only update their own profile via wallet"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth_user_id = auth.uid() OR 
  id IN (
    SELECT wc.encrypted_user_id 
    FROM public.wallet_connections wc 
    WHERE wc.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create profiles via wallet connection"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth_user_id = auth.uid() OR
  id IN (
    SELECT wc.encrypted_user_id 
    FROM public.wallet_connections wc 
    WHERE wc.user_id = auth.uid()
  )
);

-- Update bio and banner functions to require authentication
CREATE OR REPLACE FUNCTION public.update_bio_secure(encrypted_user_id text, new_bio text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Require JWT authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Verify the user owns this encrypted ID via wallet connection
  IF NOT EXISTS (
    SELECT 1 FROM public.wallet_connections 
    WHERE user_id = auth.uid() 
    AND encrypted_user_id = update_bio_secure.encrypted_user_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You can only update your own profile';
  END IF;
  
  -- Update bio
  UPDATE public.profiles
  SET 
    bio = new_bio,
    updated_at = now()
  WHERE id = update_bio_secure.encrypted_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_banner_secure(encrypted_user_id text, new_banner_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Require JWT authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Verify the user owns this encrypted ID via wallet connection
  IF NOT EXISTS (
    SELECT 1 FROM public.wallet_connections 
    WHERE user_id = auth.uid() 
    AND encrypted_user_id = update_banner_secure.encrypted_user_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You can only update your own profile';
  END IF;
  
  -- Update banner
  UPDATE public.profiles
  SET 
    banner_url = new_banner_url,
    updated_at = now()
  WHERE id = update_banner_secure.encrypted_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
END;
$$;

-- Function to securely connect a wallet to an authenticated user
CREATE OR REPLACE FUNCTION public.connect_wallet_to_user(wallet_address text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  encrypted_id text;
  existing_profile public.profiles%ROWTYPE;
BEGIN
  -- Require JWT authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Generate encrypted user ID
  encrypted_id := encrypt_wallet_address(wallet_address);
  
  -- Check if wallet is already connected to another user
  IF EXISTS (
    SELECT 1 FROM public.wallet_connections 
    WHERE wallet_address = connect_wallet_to_user.wallet_address 
    AND user_id != auth.uid()
  ) THEN
    RAISE EXCEPTION 'Wallet is already connected to another account';
  END IF;
  
  -- Create or update wallet connection
  INSERT INTO public.wallet_connections (
    user_id, 
    wallet_address, 
    encrypted_user_id,
    is_primary
  ) VALUES (
    auth.uid(), 
    wallet_address, 
    encrypted_id,
    NOT EXISTS (SELECT 1 FROM public.wallet_connections WHERE user_id = auth.uid())
  ) ON CONFLICT (user_id, wallet_address) 
  DO UPDATE SET 
    last_used_at = now(),
    encrypted_user_id = encrypted_id;
  
  -- Get or create profile
  SELECT p.* INTO existing_profile 
  FROM public.profiles p 
  WHERE p.id = encrypted_id;
  
  IF existing_profile.id IS NULL THEN
    -- Create new profile
    INSERT INTO public.profiles (
      id,
      auth_user_id,
      handle,
      display_name,
      kaspa_address,
      created_at,
      updated_at
    ) VALUES (
      encrypted_id,
      auth.uid(),
      'user_' || substring(encrypted_id from 5 for 8),
      'User ' || substring(encrypted_id from 5 for 8),
      wallet_address,
      now(),
      now()
    );
  ELSE
    -- Update existing profile to link to auth user
    UPDATE public.profiles 
    SET 
      auth_user_id = auth.uid(),
      kaspa_address = wallet_address,
      updated_at = now()
    WHERE id = encrypted_id;
  END IF;
  
  RETURN encrypted_id;
END;
$$;