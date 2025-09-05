-- Fix streams table RLS policies for proper security

-- First, drop all the overly permissive policies
DROP POLICY IF EXISTS "Anyone can create streams" ON public.streams;
DROP POLICY IF EXISTS "Anyone can delete streams" ON public.streams;
DROP POLICY IF EXISTS "Anyone can update streams" ON public.streams;
DROP POLICY IF EXISTS "Authenticated users can create streams" ON public.streams;
DROP POLICY IF EXISTS "Authenticated users can delete streams" ON public.streams;
DROP POLICY IF EXISTS "Authenticated users can update streams" ON public.streams;

-- Keep the existing SELECT policy as it allows everyone to view streams
-- Policy "Streams are viewable by everyone" already exists and is appropriate

-- Create secure policies for stream management

-- 1. Only authenticated users can create streams, and they must set themselves as the owner
CREATE POLICY "Authenticated users can create their own streams"
ON public.streams
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND user_id = (auth.uid())::text
);

-- 2. Only stream owners can update their own streams
CREATE POLICY "Stream owners can update their own streams"
ON public.streams
FOR UPDATE
TO authenticated
USING (user_id = (auth.uid())::text)
WITH CHECK (user_id = (auth.uid())::text);

-- 3. Only stream owners can delete their own streams
CREATE POLICY "Stream owners can delete their own streams"
ON public.streams
FOR DELETE
TO authenticated
USING (user_id = (auth.uid())::text);

-- 4. Allow service role (for admin functions and edge functions) to have full access
CREATE POLICY "Service role full access to streams"
ON public.streams
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Ensure user_id column is not nullable to prevent security bypass
ALTER TABLE public.streams ALTER COLUMN user_id SET NOT NULL;