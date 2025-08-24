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