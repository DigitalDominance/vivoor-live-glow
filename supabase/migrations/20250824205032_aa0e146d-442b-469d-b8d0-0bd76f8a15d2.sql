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