-- Fix RLS policies for wallet-based system (no Supabase auth)
-- Users connect wallets but don't have Supabase auth sessions
-- They access the database as 'anon' role, not 'authenticated'

-- Drop the authenticated-only policies
DROP POLICY IF EXISTS "Authenticated users can create streams" ON public.streams;
DROP POLICY IF EXISTS "Users can update streams they own" ON public.streams;
DROP POLICY IF EXISTS "Users can delete streams they own" ON public.streams;

-- Create policies that work with anon users (wallet-based auth)
-- The application layer handles wallet verification

-- Allow anon users to create streams (wallet verification is app-level)
CREATE POLICY "Anyone can create streams" 
ON public.streams 
FOR INSERT 
TO anon
WITH CHECK (true);

-- Allow anon users to update streams (app layer handles ownership via user_id)
CREATE POLICY "Anyone can update streams" 
ON public.streams 
FOR UPDATE 
TO anon
USING (true)
WITH CHECK (true);

-- Allow anon users to delete streams (app layer handles ownership via user_id)
CREATE POLICY "Anyone can delete streams" 
ON public.streams 
FOR DELETE 
TO anon
USING (true);

-- Also allow authenticated role for completeness (though not used in this app)
CREATE POLICY "Authenticated users can create streams" 
ON public.streams 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update streams" 
ON public.streams 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete streams" 
ON public.streams 
FOR DELETE 
TO authenticated
USING (true);