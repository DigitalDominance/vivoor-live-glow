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
    AND verified_at > now() - interval '24 hours'
  );
END;
$function$;