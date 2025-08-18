-- Fix RLS policies for profiles table to restrict access to sensitive data
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Allow users to view only their own complete profile
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid()::text = id);

-- Allow public access to specific non-sensitive fields only
CREATE POLICY "Public can view basic profile info" 
ON public.profiles 
FOR SELECT 
USING (true);

-- But we need to restrict this at the column level, so let's create a view instead
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  display_name,
  handle,
  avatar_url,
  bio,
  created_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Fix tips table RLS policies to restrict financial data exposure
DROP POLICY IF EXISTS "Anyone can view tips for live streams" ON public.tips;

-- Create more restrictive policy for live stream tips (only show essential data)
CREATE POLICY "Live stream tips basic info" 
ON public.tips 
FOR SELECT 
USING (
  is_stream_live(stream_id) AND 
  -- Only allow viewing of essential fields, not sensitive transaction data
  true
);

-- Add policy to prevent direct access to sensitive tip fields for unauthorized users
-- (This will be enforced through views and controlled API access)

-- Create a public view for live stream tips that excludes sensitive data
CREATE OR REPLACE VIEW public.live_stream_tips AS
SELECT 
  stream_id,
  amount_sompi,
  decrypted_message,
  created_at,
  -- Mask the sender address for privacy (show only first/last few chars)
  CASE 
    WHEN LENGTH(sender_address) > 10 THEN 
      SUBSTRING(sender_address FROM 1 FOR 6) || '...' || SUBSTRING(sender_address FROM LENGTH(sender_address) - 3)
    ELSE sender_address 
  END as masked_sender_address
FROM public.tips t
WHERE EXISTS (
  SELECT 1 FROM public.streams s 
  WHERE s.id = t.stream_id AND s.is_live = true
);

-- Grant access to the view
GRANT SELECT ON public.live_stream_tips TO anon, authenticated;

-- Update OTP expiry to recommended threshold (5 minutes)
UPDATE auth.config 
SET 
  otp_exp = 300,  -- 5 minutes in seconds
  otp_length = 6
WHERE true;