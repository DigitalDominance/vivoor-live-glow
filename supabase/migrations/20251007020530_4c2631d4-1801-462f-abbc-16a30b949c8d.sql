-- Remove heartbeat-based monitoring - all streams now monitored via Livepeer API
CREATE OR REPLACE FUNCTION public.monitor_livepeer_streams()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- All stream monitoring is now handled by the stream-monitor edge function via Livepeer API
  -- This function is deprecated but kept for backwards compatibility
  RETURN 0;
END;
$$;

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any existing stream monitoring cron jobs
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE jobname LIKE '%stream-monitor%';

-- Schedule stream-monitor edge function to run every 15 seconds
-- This will check all streams (RTMP and browser) via Livepeer API
SELECT cron.schedule(
  'stream-monitor-every-15-seconds',
  '*/15 * * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://qcowmxypihinteajhnjw.supabase.co/functions/v1/stream-monitor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjb3dteHlwaWhpbnRlYWpobmp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI4MTMsImV4cCI6MjA3MDYxODgxM30.KrSQYsOzPPhErffzdLzMS_4pC2reuONNc134tdtVPbA"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Enable realtime for tips table
ALTER TABLE public.tips REPLICA IDENTITY FULL;

-- Add tips table to realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'tips'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tips;
  END IF;
END $$;