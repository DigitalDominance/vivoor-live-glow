-- Add KASPERS NFT badge support to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS show_kaspers_badge BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS kaspers_last_verified_at TIMESTAMP WITH TIME ZONE;

-- Create kaspers_nft_badges table
CREATE TABLE IF NOT EXISTS public.kaspers_nft_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tick TEXT NOT NULL DEFAULT 'KASPER',
  token_id TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  last_verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  first_claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  verification_bonus_granted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, tick)
);

-- Enable RLS
ALTER TABLE public.kaspers_nft_badges ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "KASPERS NFT badges are viewable by everyone"
ON public.kaspers_nft_badges FOR SELECT
TO public
USING (true);

CREATE POLICY "Service role can manage KASPERS NFT badges"
ON public.kaspers_nft_badges FOR ALL
TO service_role
USING (current_setting('role', true) = 'service_role')
WITH CHECK (current_setting('role', true) = 'service_role');

-- Function to get user's KASPERS NFT badge
CREATE OR REPLACE FUNCTION public.get_user_kaspers_nft(user_id_param TEXT)
RETURNS TABLE(
  tick TEXT,
  token_id TEXT,
  is_verified BOOLEAN,
  last_verified_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kb.tick,
    kb.token_id,
    kb.is_verified,
    kb.last_verified_at
  FROM public.kaspers_nft_badges kb
  WHERE kb.user_id = user_id_param
  AND kb.is_verified = true
  LIMIT 1;
END;
$$;