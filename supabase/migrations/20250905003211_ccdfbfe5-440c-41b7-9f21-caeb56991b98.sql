-- Create reports table
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reported_stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
  reported_user_id TEXT NOT NULL,
  reporter_user_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by TEXT
);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can insert reports" 
ON public.reports 
FOR INSERT 
WITH CHECK (auth.uid()::text = reporter_user_id);

CREATE POLICY "Admin can view all reports" 
ON public.reports 
FOR SELECT 
USING (true);

CREATE POLICY "Admin can update reports" 
ON public.reports 
FOR UPDATE 
USING (true);

-- Add reports functions to admin edge function
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
SET search_path TO 'public'
AS $function$
BEGIN
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
$function$;

-- Function to resolve reports
CREATE OR REPLACE FUNCTION public.admin_resolve_report(
  report_id_param UUID,
  action_taken TEXT,
  admin_user_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.reports
  SET 
    status = 'resolved',
    resolved_at = now(),
    resolved_by = admin_user_id,
    updated_at = now()
  WHERE id = report_id_param;
END;
$function$;