-- Step 1: Drop the overly permissive policies causing the security vulnerability
DROP POLICY IF EXISTS "System can manage auth sessions" ON public.wallet_auth_sessions;
DROP POLICY IF EXISTS "Users can view their own auth sessions" ON public.wallet_auth_sessions;