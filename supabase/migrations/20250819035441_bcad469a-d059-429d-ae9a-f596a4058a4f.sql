-- Create verification records table
CREATE TABLE public.verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  txid TEXT NOT NULL UNIQUE,
  amount_sompi BIGINT NOT NULL,
  duration_type TEXT NOT NULL CHECK (duration_type IN ('monthly', 'yearly')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  block_time BIGINT NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own verifications" 
ON public.verifications 
FOR SELECT 
USING (user_id = (auth.uid())::text);

CREATE POLICY "Authenticated users can insert verifications" 
ON public.verifications 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Everyone can view verification status" 
ON public.verifications 
FOR SELECT 
USING (true);

-- Create function to check if user is verified
CREATE OR REPLACE FUNCTION public.is_user_verified(user_id_param TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.verifications 
    WHERE user_id = user_id_param 
    AND expires_at > now()
  );
$$;

-- Create function to get user verification info
CREATE OR REPLACE FUNCTION public.get_user_verification(user_id_param TEXT)
RETURNS TABLE(is_verified BOOLEAN, expires_at TIMESTAMP WITH TIME ZONE, duration_type TEXT)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT 
    CASE WHEN v.expires_at > now() THEN true ELSE false END as is_verified,
    v.expires_at,
    v.duration_type
  FROM public.verifications v
  WHERE v.user_id = user_id_param
  AND v.expires_at > now()
  ORDER BY v.expires_at DESC
  LIMIT 1;
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_verifications_updated_at
BEFORE UPDATE ON public.verifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();