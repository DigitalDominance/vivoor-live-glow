-- Step 2: Create secure policies for wallet auth sessions

-- Policy 1: Only service role can manage sessions (for authentication functions)
CREATE POLICY "Service role manages auth sessions" 
ON public.wallet_auth_sessions 
FOR ALL 
USING (current_setting('role', true) = 'service_role')
WITH CHECK (current_setting('role', true) = 'service_role');

-- Policy 2: Allow session validation (minimal read access for authentication)
CREATE POLICY "Session validation access" 
ON public.wallet_auth_sessions 
FOR SELECT 
USING (
  -- Only allow reading active, non-expired sessions for validation
  is_active = true
  AND expires_at > now()
  AND session_token IS NOT NULL 
  AND wallet_address IS NOT NULL
);