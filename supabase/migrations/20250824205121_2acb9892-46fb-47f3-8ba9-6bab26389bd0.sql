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
$function$;