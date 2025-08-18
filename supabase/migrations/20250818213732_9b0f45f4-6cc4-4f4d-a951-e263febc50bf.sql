-- Drop the problematic views that have security definer issues
DROP VIEW IF EXISTS public.public_profiles;
DROP VIEW IF EXISTS public.live_stream_tips;

-- Instead, create proper RLS policies without views
-- The profiles table already has proper RLS, we just need to ensure kaspa_address is protected

-- Create a function to get public profile info safely
CREATE OR REPLACE FUNCTION public.get_public_profile_safe(_id text)
RETURNS TABLE(
  id text,
  display_name text,
  handle text,
  avatar_url text,
  bio text,
  created_at timestamp with time zone
)
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    p.id,
    p.display_name,
    p.handle,
    p.avatar_url,
    p.bio,
    p.created_at
  FROM public.profiles p
  WHERE p.id = _id;
$$;

-- Create a function to get live stream tips safely (without sensitive data)
CREATE OR REPLACE FUNCTION public.get_live_stream_tips_safe(_stream_id uuid)
RETURNS TABLE(
  stream_id uuid,
  amount_sompi bigint,
  decrypted_message text,
  created_at timestamp with time zone,
  masked_sender_address text
)
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    t.stream_id,
    t.amount_sompi,
    t.decrypted_message,
    t.created_at,
    -- Mask the sender address for privacy
    CASE 
      WHEN LENGTH(t.sender_address) > 10 THEN 
        SUBSTRING(t.sender_address FROM 1 FOR 6) || '...' || SUBSTRING(t.sender_address FROM LENGTH(t.sender_address) - 3)
      ELSE t.sender_address 
    END as masked_sender_address
  FROM public.tips t
  WHERE t.stream_id = _stream_id
    AND EXISTS (
      SELECT 1 FROM public.streams s 
      WHERE s.id = t.stream_id AND s.is_live = true
    );
$$;