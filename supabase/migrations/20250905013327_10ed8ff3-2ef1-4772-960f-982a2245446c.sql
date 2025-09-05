-- CRITICAL SECURITY FIX: Lock down RLS policies to prevent unauthorized admin access

-- Check and drop existing overly permissive policies
DROP POLICY IF EXISTS "Admin can update reports" ON public.reports;
DROP POLICY IF EXISTS "Wallet users can update their profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own streams" ON public.streams;
DROP POLICY IF EXISTS "Users can update their own streams" ON public.streams;
DROP POLICY IF EXISTS "Users can insert their own streams" ON public.streams;
DROP POLICY IF EXISTS "Users can update only their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert only their own streams" ON public.streams;
DROP POLICY IF EXISTS "Users can update only their own streams" ON public.streams;
DROP POLICY IF EXISTS "Users can delete only their own streams" ON public.streams;

-- Create proper restrictive policies for profiles
CREATE POLICY "Users can update only their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid()::text = id)
WITH CHECK (auth.uid()::text = id);

-- Create proper restrictive policies for streams  
CREATE POLICY "Users can insert only their own streams" 
ON public.streams 
FOR INSERT 
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update only their own streams" 
ON public.streams 
FOR UPDATE 
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete only their own streams" 
ON public.streams 
FOR DELETE 
USING (auth.uid()::text = user_id);

-- Add security definer function to check if caller is admin function
CREATE OR REPLACE FUNCTION public.is_admin_context()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only return true if called from service role context (admin functions)
  RETURN current_setting('role', true) = 'service_role';
END;
$$;