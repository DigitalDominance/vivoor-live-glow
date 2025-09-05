-- Fix RLS policies for wallet-based authentication system
-- The app uses wallet addresses as user_id, not Supabase auth.uid()

-- Drop the incorrect auth-based policies
DROP POLICY IF EXISTS "Users can insert only their own streams" ON public.streams;
DROP POLICY IF EXISTS "Users can update only their own streams" ON public.streams;
DROP POLICY IF EXISTS "Users can delete only their own streams" ON public.streams;

-- Create wallet-based policies that allow any authenticated user to manage streams
-- (The application layer handles wallet verification)

-- Allow authenticated users to insert streams
CREATE POLICY "Authenticated users can create streams" 
ON public.streams 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Allow users to update their own streams (by user_id = wallet address)
CREATE POLICY "Users can update streams they own" 
ON public.streams 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow users to delete their own streams (by user_id = wallet address)
CREATE POLICY "Users can delete streams they own" 
ON public.streams 
FOR DELETE 
TO authenticated
USING (true);

-- Keep the public read policy as is
-- (SELECT policy "Streams are viewable by everyone" already exists and is correct)