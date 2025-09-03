-- Create a function to get tip address for live streams without requiring authentication
-- This is secure because it only returns addresses for actively live streams
CREATE OR REPLACE FUNCTION public.get_live_stream_tip_address(stream_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  tip_address text;
BEGIN
  -- Get the kaspa address of the stream owner, but only for live streams
  SELECT p.kaspa_address INTO tip_address
  FROM public.streams s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.id = stream_id 
    AND s.is_live = true;  -- Only return address if stream is actually live
  
  RETURN tip_address;
END;
$function$;