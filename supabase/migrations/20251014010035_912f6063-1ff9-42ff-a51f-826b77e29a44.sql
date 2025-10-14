-- Add selected flag to kaspers_nft_badges to support multiple NFTs per user
ALTER TABLE public.kaspers_nft_badges
DROP CONSTRAINT IF EXISTS kaspers_nft_badges_user_id_tick_key;

-- Add is_selected column to track which NFT is currently displayed
ALTER TABLE public.kaspers_nft_badges
ADD COLUMN IF NOT EXISTS is_selected boolean DEFAULT false;

-- Create new unique constraint on user_id, tick, and token_id (allows multiple NFTs per user)
ALTER TABLE public.kaspers_nft_badges
ADD CONSTRAINT kaspers_nft_badges_user_id_tick_token_id_key UNIQUE (user_id, tick, token_id);

-- Create index for faster lookups of selected NFT
CREATE INDEX IF NOT EXISTS idx_kaspers_selected ON public.kaspers_nft_badges(user_id, is_selected) WHERE is_selected = true;

-- Drop and recreate RPC function with new return type
DROP FUNCTION IF EXISTS public.get_user_kaspers_nft(text);

CREATE FUNCTION public.get_user_kaspers_nft(user_id_param text)
RETURNS TABLE(tick text, token_id text, is_verified boolean, last_verified_at timestamp with time zone, is_selected boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kb.tick,
    kb.token_id,
    kb.is_verified,
    kb.last_verified_at,
    kb.is_selected
  FROM public.kaspers_nft_badges kb
  WHERE kb.user_id = user_id_param
  AND kb.is_verified = true
  ORDER BY kb.is_selected DESC, kb.token_id ASC
  LIMIT 1;
END;
$$;

-- Add function to get all KASPERS NFTs for a user
CREATE OR REPLACE FUNCTION public.get_user_all_kaspers_nfts(user_id_param text)
RETURNS TABLE(tick text, token_id text, is_verified boolean, last_verified_at timestamp with time zone, is_selected boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kb.tick,
    kb.token_id,
    kb.is_verified,
    kb.last_verified_at,
    kb.is_selected
  FROM public.kaspers_nft_badges kb
  WHERE kb.user_id = user_id_param
  AND kb.is_verified = true
  ORDER BY kb.is_selected DESC, kb.token_id ASC;
END;
$$;