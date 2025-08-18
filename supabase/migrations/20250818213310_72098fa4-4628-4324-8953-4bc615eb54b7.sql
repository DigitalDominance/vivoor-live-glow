-- Fix search_path for security definer functions
CREATE OR REPLACE FUNCTION public.get_current_user_kaspa_address()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT kaspa_address 
    FROM public.profiles 
    WHERE id = auth.uid()::text
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = 'public';

CREATE OR REPLACE FUNCTION public.user_owns_stream(stream_id_param uuid)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 
    FROM public.streams 
    WHERE id = stream_id_param 
    AND user_id = auth.uid()::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = 'public';

CREATE OR REPLACE FUNCTION public.is_stream_live(stream_id_param uuid)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 
    FROM public.streams 
    WHERE id = stream_id_param 
    AND is_live = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = 'public';