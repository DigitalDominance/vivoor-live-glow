-- Add show_kns_badge column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS show_kns_badge boolean DEFAULT false;

-- Create kns_domains table to cache KNS data
CREATE TABLE IF NOT EXISTS public.kns_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_address text NOT NULL,
  inscription_id text NOT NULL,
  domain_name text NOT NULL,
  tld text NOT NULL,
  full_name text NOT NULL,
  is_verified boolean NOT NULL DEFAULT false,
  status text,
  last_verified_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on kns_domains
ALTER TABLE public.kns_domains ENABLE ROW LEVEL SECURITY;

-- RLS policies for kns_domains
CREATE POLICY "KNS domains are viewable by everyone"
  ON public.kns_domains
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage KNS domains"
  ON public.kns_domains
  FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_kns_domains_user_id ON public.kns_domains(user_id);
CREATE INDEX IF NOT EXISTS idx_kns_domains_owner_address ON public.kns_domains(owner_address);

-- Function to get user's KNS domain
CREATE OR REPLACE FUNCTION public.get_user_kns_domain(user_id_param text)
RETURNS TABLE(
  full_name text,
  domain_name text,
  tld text,
  is_verified boolean,
  last_verified_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kd.full_name,
    kd.domain_name,
    kd.tld,
    kd.is_verified,
    kd.last_verified_at
  FROM public.kns_domains kd
  WHERE kd.user_id = user_id_param
  AND kd.is_verified = true
  LIMIT 1;
END;
$$;