-- Add treasury transaction tracking and improve stream management

-- Update streams table to track treasury payments and ensure only one active stream per user
ALTER TABLE public.streams ADD COLUMN treasury_txid TEXT;
ALTER TABLE public.streams ADD COLUMN treasury_block_time BIGINT;
ALTER TABLE public.streams ADD COLUMN ended_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster queries on active streams per user
CREATE INDEX idx_streams_user_live ON public.streams(user_id, is_live) WHERE is_live = true;

-- Create function to check if user has active stream
CREATE OR REPLACE FUNCTION public.user_has_active_stream(user_id_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM public.streams 
    WHERE user_id = user_id_param AND is_live = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create tips table for encrypted tip tracking
CREATE TABLE public.tips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  sender_address TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  amount_sompi BIGINT NOT NULL,
  txid TEXT NOT NULL UNIQUE,
  encrypted_message TEXT,
  decrypted_message TEXT,
  block_time BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS for tips
ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

-- Tips are viewable by everyone (for stream notifications)
CREATE POLICY "Tips are viewable by everyone" 
ON public.tips 
FOR SELECT 
USING (true);

-- Only authenticated users can insert tips (via API)
CREATE POLICY "Authenticated users can insert tips" 
ON public.tips 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for efficient tip queries
CREATE INDEX idx_tips_stream_id ON public.tips(stream_id);
CREATE INDEX idx_tips_txid ON public.tips(txid);
CREATE INDEX idx_tips_block_time ON public.tips(block_time);

-- Function to end all active streams for a user (enforce single stream rule)
CREATE OR REPLACE FUNCTION public.end_user_active_streams(user_id_param TEXT)
RETURNS INTEGER AS $$
DECLARE
  ended_count INTEGER;
BEGIN
  UPDATE public.streams 
  SET is_live = false, ended_at = now()
  WHERE user_id = user_id_param AND is_live = true;
  
  GET DIAGNOSTICS ended_count = ROW_COUNT;
  RETURN ended_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate treasury payment
CREATE OR REPLACE FUNCTION public.validate_treasury_payment(
  txid_param TEXT,
  user_address_param TEXT,
  treasury_address_param TEXT DEFAULT 'kaspa:qzs7mlxwqtuyvv47yhx0xzhmphpazxzw99patpkh3ezfghejhq8wv6jsc7f80'
)
RETURNS TABLE(is_valid BOOLEAN, block_time BIGINT, amount_sompi BIGINT) AS $$
BEGIN
  -- This function would be called after verifying the transaction via Kaspa API
  -- For now, return placeholder - the actual validation will be done in the frontend/edge function
  RETURN QUERY SELECT true::BOOLEAN, 0::BIGINT, 0::BIGINT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to automatically set ended_at when stream is marked as not live
CREATE OR REPLACE FUNCTION public.set_stream_ended_at()
RETURNS TRIGGER AS $$
BEGIN
  -- If stream is being set to not live and ended_at is not set
  IF NEW.is_live = false AND OLD.is_live = true AND NEW.ended_at IS NULL THEN
    NEW.ended_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_stream_ended_at
  BEFORE UPDATE ON public.streams
  FOR EACH ROW
  EXECUTE FUNCTION public.set_stream_ended_at();