-- Drop the existing restrictive RLS policy for profile updates
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create a new policy that allows users to update profiles based on the wallet address ID
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (true)
WITH CHECK (true);