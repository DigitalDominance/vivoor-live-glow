-- CRITICAL SECURITY FIX: Lock down stream_viewers and reports tables

-- ========== STREAM_VIEWERS SECURITY FIX ==========
-- Drop all existing policies and recreate securely
DROP POLICY IF EXISTS "Anyone can view stream viewers" ON public.stream_viewers;
DROP POLICY IF EXISTS "Users can delete their viewer session" ON public.stream_viewers;
DROP POLICY IF EXISTS "Users can insert their viewer session" ON public.stream_viewers;
DROP POLICY IF EXISTS "Users can update their viewer session" ON public.stream_viewers;
DROP POLICY IF EXISTS "Users can insert their own viewer session" ON public.stream_viewers;
DROP POLICY IF EXISTS "Users can update their own viewer session" ON public.stream_viewers;
DROP POLICY IF EXISTS "Users can delete their own viewer session" ON public.stream_viewers;
DROP POLICY IF EXISTS "Stream owners can view their stream viewers" ON public.stream_viewers;
DROP POLICY IF EXISTS "Users can view their own viewer sessions" ON public.stream_viewers;

-- Create secure policies for stream_viewers
CREATE POLICY "Users can manage their own sessions" 
ON public.stream_viewers 
FOR INSERT 
WITH CHECK (auth.uid()::text = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their sessions" 
ON public.stream_viewers 
FOR UPDATE 
USING (auth.uid()::text = user_id OR user_id IS NULL)
WITH CHECK (auth.uid()::text = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete their sessions" 
ON public.stream_viewers 
FOR DELETE 
USING (auth.uid()::text = user_id OR user_id IS NULL);

-- Stream owners can view viewer data for their streams
CREATE POLICY "Stream owners see their viewers" 
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
CREATE POLICY "Users see own sessions" 
ON public.stream_viewers 
FOR SELECT 
USING (auth.uid()::text = user_id);

-- ========== REPORTS SECURITY FIX ==========
-- Drop the dangerous policies
DROP POLICY IF EXISTS "Anyone can view reports" ON public.reports;
DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
DROP POLICY IF EXISTS "Service role can access all reports" ON public.reports;
DROP POLICY IF EXISTS "Service role can update reports" ON public.reports;

-- Create secure policies for reports
CREATE POLICY "Users view own reports only" 
ON public.reports 
FOR SELECT 
USING (auth.uid()::text = reporter_user_id);

-- Admin functions can access all reports (service role only)
CREATE POLICY "Service role full access" 
ON public.reports 
FOR SELECT 
USING (current_setting('role', true) = 'service_role');

-- Admin functions can update reports (service role only)
CREATE POLICY "Service role can modify" 
ON public.reports 
FOR UPDATE 
USING (current_setting('role', true) = 'service_role')
WITH CHECK (current_setting('role', true) = 'service_role');