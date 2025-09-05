-- CRITICAL SECURITY FIX: Lock down RLS policies to prevent unauthorized admin access

-- First, drop the overly permissive policies
DROP POLICY IF EXISTS "Admin can update reports" ON public.reports;
DROP POLICY IF EXISTS "Wallet users can update their profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own streams" ON public.streams;
DROP POLICY IF EXISTS "Users can update their own streams" ON public.streams;
DROP POLICY IF EXISTS "Users can insert their own streams" ON public.streams;

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

-- Reports should NOT be updatable by regular users at all
-- Only admin functions using service role can update them
-- Remove all update policies for reports table

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

-- Secure admin functions to ensure they can only be called with service role
-- Update admin functions to include additional security checks

-- Make admin_ban_user more secure
CREATE OR REPLACE FUNCTION public.admin_ban_user(user_id_param text, ban_status boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Additional security: Only allow if called with service role
  IF current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Admin function access denied';
  END IF;
  
  -- Update user ban status
  UPDATE public.profiles
  SET banned = ban_status, updated_at = now()
  WHERE id = user_id_param;
  
  -- If banning user, end all their active streams
  IF ban_status = true THEN
    UPDATE public.streams
    SET is_live = false, ended_at = COALESCE(ended_at, now())
    WHERE user_id = user_id_param AND is_live = true;
  END IF;
END;
$$;

-- Make admin_delete_stream more secure
CREATE OR REPLACE FUNCTION public.admin_delete_stream(stream_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Additional security: Only allow if called with service role
  IF current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Admin function access denied';
  END IF;
  
  DELETE FROM public.streams
  WHERE id = stream_id_param;
END;
$$;

-- Make admin_resolve_report more secure
CREATE OR REPLACE FUNCTION public.admin_resolve_report(
  report_id_param UUID,
  action_taken TEXT,
  admin_user_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Additional security: Only allow if called with service role
  IF current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Admin function access denied';
  END IF;
  
  UPDATE public.reports
  SET 
    status = 'resolved',
    resolved_at = now(),
    resolved_by = admin_user_id,
    updated_at = now()
  WHERE id = report_id_param;
END;
$$;

-- Secure admin_get_users 
CREATE OR REPLACE FUNCTION public.admin_get_users(
  search_query text DEFAULT NULL,
  limit_param integer DEFAULT 50,
  offset_param integer DEFAULT 0
)
RETURNS TABLE(
  id text,
  handle text,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone,
  banned boolean,
  stream_count integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Additional security: Only allow if called with service role
  IF current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Admin function access denied';
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id,
    p.handle,
    p.display_name,
    p.avatar_url,
    p.created_at,
    p.banned,
    (SELECT COUNT(*)::integer FROM public.streams s WHERE s.user_id = p.id) as stream_count
  FROM public.profiles p
  WHERE (
    search_query IS NULL 
    OR p.handle ILIKE '%' || search_query || '%' 
    OR p.display_name ILIKE '%' || search_query || '%'
    OR p.id ILIKE '%' || search_query || '%'
  )
  ORDER BY p.created_at DESC
  LIMIT LEAST(GREATEST(limit_param, 0), 100)
  OFFSET GREATEST(offset_param, 0);
END;
$$;

-- Secure admin_get_reports
CREATE OR REPLACE FUNCTION public.admin_get_reports(
  limit_param INTEGER DEFAULT 50,
  offset_param INTEGER DEFAULT 0,
  status_filter TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  reported_stream_id UUID,
  reported_user_id TEXT,
  reporter_user_id TEXT,
  report_type TEXT,
  description TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  stream_title TEXT,
  reported_user_handle TEXT,
  reported_user_display_name TEXT,
  reporter_user_handle TEXT,
  reporter_user_display_name TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Additional security: Only allow if called with service role
  IF current_setting('role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Admin function access denied';
  END IF;
  
  RETURN QUERY
  SELECT 
    r.id,
    r.reported_stream_id,
    r.reported_user_id,
    r.reporter_user_id,
    r.report_type,
    r.description,
    r.status,
    r.created_at,
    s.title as stream_title,
    rp.handle as reported_user_handle,
    rp.display_name as reported_user_display_name,
    rep.handle as reporter_user_handle,
    rep.display_name as reporter_user_display_name
  FROM public.reports r
  LEFT JOIN public.streams s ON s.id = r.reported_stream_id
  LEFT JOIN public.profiles rp ON rp.id = r.reported_user_id
  LEFT JOIN public.profiles rep ON rep.id = r.reporter_user_id
  WHERE (status_filter IS NULL OR r.status = status_filter)
  ORDER BY r.created_at DESC
  LIMIT LEAST(GREATEST(limit_param, 0), 100)
  OFFSET GREATEST(offset_param, 0);
END;
$$;