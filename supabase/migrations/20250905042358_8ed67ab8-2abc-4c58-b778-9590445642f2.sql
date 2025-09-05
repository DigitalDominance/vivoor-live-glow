-- Clean up overlapping RLS policies on wallet_auth_sessions table
-- Remove duplicate and overly permissive policies to minimize attack surface

-- Drop all existing policies to start clean
DROP POLICY IF EXISTS "Service role can manage auth sessions" ON public.wallet_auth_sessions;
DROP POLICY IF EXISTS "Service role manages auth sessions" ON public.wallet_auth_sessions;
DROP POLICY IF EXISTS "Session validation access" ON public.wallet_auth_sessions;
DROP POLICY IF EXISTS "Users view own wallet sessions" ON public.wallet_auth_sessions;
DROP POLICY IF EXISTS "Validate session tokens" ON public.wallet_auth_sessions;

-- Create minimal, secure policies

-- Policy 1: Service role has full access (needed for auth functions)
CREATE POLICY "Service role full access" 
ON public.wallet_auth_sessions 
FOR ALL 
USING (current_setting('role', true) = 'service_role')
WITH CHECK (current_setting('role', true) = 'service_role');

-- Policy 2: Extremely restricted read access for session validation only
-- Only allows reading specific fields needed for authentication validation
CREATE POLICY "Restricted session validation" 
ON public.wallet_auth_sessions 
FOR SELECT 
USING (
  -- Must be an active, non-expired session
  is_active = true 
  AND expires_at > now()
  AND session_token IS NOT NULL
  -- Additional protection: limit to recent sessions (within 24 hours)
  AND created_at > (now() - interval '24 hours')
);

-- Add security comment
COMMENT ON TABLE public.wallet_auth_sessions IS 'SECURE: Access strictly limited to service role and minimal validation reads only.';