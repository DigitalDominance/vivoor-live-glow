-- CRITICAL SECURITY FIX: Lock down stream_viewers and reports tables

-- ========== STREAM_VIEWERS SECURITY FIX ==========
-- Drop the overly permissive "Anyone can view stream viewers" policy
DROP POLICY IF EXISTS "Anyone can view stream viewers" ON public.stream_viewers;
DROP POLICY IF EXISTS "Users can delete their viewer session" ON public.stream_viewers;
DROP POLICY IF EXISTS "Users can insert their viewer session" ON public.stream_viewers;
DROP POLICY IF EXISTS "Users can update their viewer session" ON public.stream_viewers;

-- Create secure policies for stream_viewers
-- Only allow users to manage their own viewer sessions
CREATE POLICY "Users can insert their own viewer session" 
ON public.stream_viewers 
FOR INSERT 
WITH CHECK (auth.uid()::text = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own viewer session" 
ON public.stream_viewers 
FOR UPDATE 
USING (auth.uid()::text = user_id OR user_id IS NULL)
WITH CHECK (auth.uid()::text = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete their own viewer session" 
ON public.stream_viewers 
FOR DELETE 
USING (auth.uid()::text = user_id OR user_id IS NULL);

-- Stream owners can view viewer data for their streams
CREATE POLICY "Stream owners can view their stream viewers" 
ON public.stream_viewers 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.streams s 
    WHERE s.id = stream_viewers.stream_id 
    AND s.user_id = auth.uid()::text
  )
);

-- Users can view their own viewing sessions
CREATE POLICY "Users can view their own viewer sessions" 
ON public.stream_viewers 
FOR SELECT 
USING (auth.uid()::text = user_id);

-- ========== REPORTS SECURITY FIX ==========
-- Drop the dangerous "Anyone can view reports" policy
DROP POLICY IF EXISTS "Anyone can view reports" ON public.reports;

-- Create secure policies for reports
-- Only users can view their own reports
CREATE POLICY "Users can view their own reports" 
ON public.reports 
FOR SELECT 
USING (auth.uid()::text = reporter_user_id);

-- Admin functions can access all reports (service role only)
CREATE POLICY "Service role can access all reports" 
ON public.reports 
FOR SELECT 
USING (current_setting('role', true) = 'service_role');

-- Admin functions can update reports (service role only)
CREATE POLICY "Service role can update reports" 
ON public.reports 
FOR UPDATE 
USING (current_setting('role', true) = 'service_role')
WITH CHECK (current_setting('role', true) = 'service_role');

-- ========== CREATE SECURE VIEWER COUNT FUNCTION ==========
-- Public function to get ONLY viewer counts (no sensitive data)
CREATE OR REPLACE FUNCTION public.get_stream_viewer_count(stream_id_param uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT session_id)::integer
  FROM public.stream_viewers
  WHERE stream_id = stream_id_param
  AND last_heartbeat > now() - interval '2 minutes';
$$;

-- ========== CREATE SECURE VIEWER LIST FUNCTION ==========
-- Function for stream owners to get viewer details for their streams
CREATE OR REPLACE FUNCTION public.get_stream_viewers_for_owner(stream_id_param uuid)
RETURNS TABLE(
  session_id text,
  user_id text,
  joined_at timestamp with time zone,
  last_heartbeat timestamp with time zone
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow stream owners to see viewer details
  IF NOT EXISTS (
    SELECT 1 FROM public.streams s 
    WHERE s.id = stream_id_param 
    AND s.user_id = auth.uid()::text
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You can only view viewers for your own streams';
  END IF;
  
  RETURN QUERY
  SELECT 
    sv.session_id,
    sv.user_id,
    sv.joined_at,
    sv.last_heartbeat
  FROM public.stream_viewers sv
  WHERE sv.stream_id = stream_id_param
  AND sv.last_heartbeat > now() - interval '2 minutes'
  ORDER BY sv.joined_at DESC;
END;
$$;