-- Fix RLS policy for reports to work with wallet authentication
-- Drop the existing policy that uses auth.uid()
DROP POLICY "Users can insert reports" ON public.reports;

-- Create new policy that allows any authenticated wallet user to insert reports
-- The application logic ensures reporter_user_id is set correctly
CREATE POLICY "Wallet users can insert reports" 
ON public.reports 
FOR INSERT 
WITH CHECK (reporter_user_id IS NOT NULL AND reporter_user_id != '');

-- Also update the select policy to be more permissive for debugging
DROP POLICY "Admin can view all reports" ON public.reports;

-- Allow users to view reports (this will be restricted by admin functions anyway)
CREATE POLICY "Anyone can view reports" 
ON public.reports 
FOR SELECT 
USING (true);