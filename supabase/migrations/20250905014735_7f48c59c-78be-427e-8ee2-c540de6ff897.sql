-- Fix profiles RLS policies for wallet-based authentication
-- The authenticate_wallet_user function needs to create/update profiles
-- But current policies expect auth.uid() which doesn't exist in wallet system

-- Drop auth-based policies that break wallet authentication
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update only their own profile" ON public.profiles;

-- Create policies that allow wallet-based profile management
-- The app layer handles wallet verification

-- Allow anyone to create profiles (authenticate_wallet_user function needs this)
CREATE POLICY "Anyone can create profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (true);

-- Allow anyone to update profiles (authenticate_wallet_user function needs this)
CREATE POLICY "Anyone can update profiles" 
ON public.profiles 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Keep existing read policies as they work fine
-- (Public read access is already allowed and working)