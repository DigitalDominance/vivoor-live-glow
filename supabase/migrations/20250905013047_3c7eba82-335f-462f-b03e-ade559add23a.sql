-- CRITICAL SECURITY FIX: Lock down admin functions to ONLY be callable by service role

-- Revoke all existing permissions on admin functions
REVOKE ALL ON FUNCTION public.admin_ban_user(text, boolean) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.admin_get_users(text, integer, integer) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.admin_delete_stream(uuid) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.admin_get_reports(integer, integer, text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.admin_resolve_report(uuid, text, text) FROM PUBLIC, authenticated;

-- Grant execute permissions ONLY to service_role
GRANT EXECUTE ON FUNCTION public.admin_ban_user(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_users(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_stream(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_reports(integer, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, text) TO service_role;

-- Add additional validation to admin functions to ensure they can only be called by service role
CREATE OR REPLACE FUNCTION public.admin_ban_user(user_id_param text, ban_status boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Ensure only service role can execute this
  IF current_setting('role') != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: Only admin functions can call this';
  END IF;
  
  -- Validate input parameters
  IF user_id_param IS NULL OR user_id_param = '' THEN
    RAISE EXCEPTION 'Invalid user_id parameter';
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

CREATE OR REPLACE FUNCTION public.admin_delete_stream(stream_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Ensure only service role can execute this
  IF current_setting('role') != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: Only admin functions can call this';
  END IF;
  
  -- Validate input parameters
  IF stream_id_param IS NULL THEN
    RAISE EXCEPTION 'Invalid stream_id parameter';
  END IF;
  
  DELETE FROM public.streams
  WHERE id = stream_id_param;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(
  report_id_param UUID,
  action_taken TEXT,
  admin_user_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Ensure only service role can execute this
  IF current_setting('role') != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: Only admin functions can call this';
  END IF;
  
  -- Validate input parameters
  IF report_id_param IS NULL THEN
    RAISE EXCEPTION 'Invalid report_id parameter';
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