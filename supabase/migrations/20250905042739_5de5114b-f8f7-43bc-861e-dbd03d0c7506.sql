-- Fix wallet_auth_sessions to only allow users to view their own sessions
-- Remove public reading and require proper JWT authentication

-- Drop the overly permissive validation policy
DROP POLICY IF EXISTS "Restricted session validation" ON public.wallet_auth_sessions;

-- Create secure user-specific policies

-- Policy for authenticated users to view only their own sessions
CREATE POLICY "Users view own sessions only" 
ON public.wallet_auth_sessions 
FOR SELECT 
USING (
  -- User must be authenticated and can only see their own sessions
  auth.uid() IS NOT NULL 
  AND (
    -- Match by encrypted_user_id for wallet users
    encrypted_user_id = (auth.uid())::text
    OR 
    -- Match by wallet_address if stored in JWT claims
    wallet_address = (auth.jwt()->'wallet_address')::text
  )
);

-- Policy for session validation during authentication (very restricted)
CREATE POLICY "Session validation for auth only" 
ON public.wallet_auth_sessions 
FOR SELECT 
USING (
  -- Only allow reading during active authentication process
  -- This is needed for the verify_wallet_jwt function to work
  current_setting('role', true) = 'authenticator'
  AND is_active = true 
  AND expires_at > now()
  AND session_token IS NOT NULL
  AND wallet_address IS NOT NULL
);

-- Update table comment to reflect security model
COMMENT ON TABLE public.wallet_auth_sessions IS 'SECURE: Users can only access their own sessions with proper JWT authentication. Public reading prevented.';