-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Tips are viewable by everyone" ON public.tips;

-- Create a function to get the current user's kaspa address
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create a function to check if a user owns a stream
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create a function to check if a stream is currently live
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create new restrictive policies for tips
CREATE POLICY "Users can view tips they sent"
ON public.tips
FOR SELECT
USING (sender_address = public.get_current_user_kaspa_address());

CREATE POLICY "Users can view tips they received"
ON public.tips
FOR SELECT
USING (recipient_address = public.get_current_user_kaspa_address());

CREATE POLICY "Users can view tips for their own streams"
ON public.tips
FOR SELECT
USING (public.user_owns_stream(stream_id));

CREATE POLICY "Anyone can view tips for live streams"
ON public.tips
FOR SELECT
USING (public.is_stream_live(stream_id));