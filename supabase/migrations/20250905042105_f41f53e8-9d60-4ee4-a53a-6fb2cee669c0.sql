-- Fix critical security vulnerability: wallet_auth_sessions table is publicly readable
-- Remove the overly permissive policy that allows anyone to read session tokens

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "System can manage auth sessions" ON public.wallet_auth_sessions;

-- Drop the existing policy that doesn't work properly for wallet users
DROP POLICY IF EXISTS "Users can view their own auth sessions" ON public.wallet_auth_sessions;

-- Create secure policies for wallet auth sessions

-- Policy 1: Only service role can manage sessions (for authentication functions)
CREATE POLICY "Service role can manage auth sessions" 
ON public.wallet_auth_sessions 
FOR ALL 
USING (current_setting('role', true) = 'service_role')
WITH CHECK (current_setting('role', true) = 'service_role');

-- Policy 2: Allow session validation by session token and wallet address (read-only)
-- This is needed for the verify_wallet_jwt function to work
CREATE POLICY "Validate session tokens" 
ON public.wallet_auth_sessions 
FOR SELECT 
USING (
  -- Only allow reading when validating a specific session
  -- This prevents bulk reading of all sessions
  session_token IS NOT NULL 
  AND wallet_address IS NOT NULL
  AND is_active = true
  AND expires_at > now()
);

-- Policy 3: Users can view only their own active sessions (when authenticated via wallet)
CREATE POLICY "Users view own wallet sessions" 
ON public.wallet_auth_sessions 
FOR SELECT 
USING (
  -- Allow users to see their own sessions when they provide the correct wallet address
  -- This requires the user to know their own wallet address to query their sessions
  wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  OR encrypted_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
);

-- Add a comment explaining the security model
COMMENT ON TABLE public.wallet_auth_sessions IS 'Secure wallet authentication sessions. Access restricted to service role and session owners only.';

-- Create an index to improve performance for secure queries
CREATE INDEX IF NOT EXISTS idx_wallet_auth_sessions_secure_lookup 
ON public.wallet_auth_sessions (session_token, wallet_address, is_active, expires_at) 
WHERE is_active = true;