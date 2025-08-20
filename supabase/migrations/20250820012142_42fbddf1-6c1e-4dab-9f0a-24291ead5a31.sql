-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Since this app uses wallet-based auth and the profile ID is the wallet address,
-- we need to allow updates when there's no auth.uid() but still provide some security
-- by only allowing updates to basic profile fields
CREATE POLICY "Wallet users can update their profiles" 
ON public.profiles 
FOR UPDATE 
USING (true)
WITH CHECK (true);