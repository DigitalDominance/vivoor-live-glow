-- Fix function search path security warnings by adding SET search_path to all functions

-- Fix user_has_active_stream function
CREATE OR REPLACE FUNCTION public.user_has_active_stream(user_id_param TEXT)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM public.streams 
    WHERE user_id = user_id_param AND is_live = true
  );
END;
$$;

-- Fix end_user_active_streams function  
CREATE OR REPLACE FUNCTION public.end_user_active_streams(user_id_param TEXT)
RETURNS INTEGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public'
AS $$
DECLARE
  ended_count INTEGER;
BEGIN
  UPDATE public.streams 
  SET is_live = false, ended_at = now()
  WHERE user_id = user_id_param AND is_live = true;
  
  GET DIAGNOSTICS ended_count = ROW_COUNT;
  RETURN ended_count;
END;
$$;

-- Fix validate_treasury_payment function
CREATE OR REPLACE FUNCTION public.validate_treasury_payment(
  txid_param TEXT,
  user_address_param TEXT,
  treasury_address_param TEXT DEFAULT 'kaspa:qzs7mlxwqtuyvv47yhx0xzhmphpazxzw99patpkh3ezfghejhq8wv6jsc7f80'
)
RETURNS TABLE(is_valid BOOLEAN, block_time BIGINT, amount_sompi BIGINT) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public'
AS $$
BEGIN
  -- This function would be called after verifying the transaction via Kaspa API
  -- For now, return placeholder - the actual validation will be done in the frontend/edge function
  RETURN QUERY SELECT true::BOOLEAN, 0::BIGINT, 0::BIGINT;
END;
$$;

-- Fix set_stream_ended_at function
CREATE OR REPLACE FUNCTION public.set_stream_ended_at()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SET search_path = 'public'
AS $$
BEGIN
  -- If stream is being set to not live and ended_at is not set
  IF NEW.is_live = false AND OLD.is_live = true AND NEW.ended_at IS NULL THEN
    NEW.ended_at = now();
  END IF;
  RETURN NEW;
END;
$$;