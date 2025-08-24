-- Create table to track stream start payments and verification payments
CREATE TABLE public.payment_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  payment_type text NOT NULL CHECK (payment_type IN ('stream_start', 'monthly_verification', 'yearly_verification')),
  amount_sompi bigint NOT NULL,
  amount_kas decimal(10,2) NOT NULL,
  txid text NOT NULL UNIQUE,
  block_time bigint NOT NULL,
  treasury_address text NOT NULL DEFAULT 'kaspa:qzs7mlxwqtuyvv47yhx0xzhmphpazxzw99patpkh3ezfghejhq8wv6jsc7f80',
  verified_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_verifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own payment verifications" 
ON public.payment_verifications 
FOR SELECT 
USING (user_id = auth.uid()::text);

CREATE POLICY "System can insert payment verifications" 
ON public.payment_verifications 
FOR INSERT 
WITH CHECK (true);

-- Create function to check if user has valid stream start payment
CREATE OR REPLACE FUNCTION public.user_has_valid_stream_payment(user_id_param text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM public.payment_verifications 
    WHERE user_id = user_id_param 
    AND payment_type = 'stream_start'
    AND verified_at > now() - interval '24 hours'  -- Payment valid for 24 hours
  );
END;
$function$

-- Create function to check if user has active verification
CREATE OR REPLACE FUNCTION public.user_has_active_verification(user_id_param text)
RETURNS TABLE(is_verified boolean, expires_at timestamp with time zone, payment_type text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN pv.expires_at > now() THEN true ELSE false END as is_verified,
    pv.expires_at,
    pv.payment_type
  FROM public.payment_verifications pv
  WHERE pv.user_id = user_id_param
  AND pv.payment_type IN ('monthly_verification', 'yearly_verification')
  AND pv.expires_at > now()
  ORDER BY pv.expires_at DESC
  LIMIT 1;
END;
$function$

-- Update updated_at trigger
CREATE TRIGGER update_payment_verifications_updated_at
BEFORE UPDATE ON public.payment_verifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update existing verifications table to have consistent naming
ALTER TABLE public.verifications ADD COLUMN IF NOT EXISTS payment_verification_id uuid REFERENCES public.payment_verifications(id);

-- Create function to validate Kaspa payment 
CREATE OR REPLACE FUNCTION public.validate_kaspa_payment(
  user_address_param text,
  expected_amount_param bigint,
  payment_type_param text,
  treasury_address_param text DEFAULT 'kaspa:qzs7mlxwqtuyvv47yhx0xzhmphpazxzw99patpkh3ezfghejhq8wv6jsc7f80'
)
RETURNS TABLE(is_valid boolean, txid text, block_time bigint, amount_kas decimal)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- This function will be called by the frontend after checking Kaspa API
  -- It validates and records the payment in our system
  -- The actual Kaspa validation must happen on the frontend/edge function
  
  -- Return placeholder for now - actual validation logic will be in edge functions
  RETURN QUERY SELECT false::boolean, ''::text, 0::bigint, 0::decimal;
END;
$function$