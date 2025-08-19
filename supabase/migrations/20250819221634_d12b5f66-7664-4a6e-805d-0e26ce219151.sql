-- Move pg_cron and pg_net extensions to extensions schema
DROP EXTENSION IF EXISTS pg_cron;
DROP EXTENSION IF EXISTS pg_net;

-- Create extensions in the extensions schema (if it doesn't exist)
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Reschedule the cron job with proper schema reference
SELECT extensions.cron.unschedule('monitor-livepeer-streams');
SELECT extensions.cron.schedule(
  'monitor-livepeer-streams',
  '* * * * *', -- every minute
  $$
  select
    extensions.net.http_post(
        url:='https://qcowmxypihinteajhnjw.supabase.co/functions/v1/stream-monitor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjb3dteHlwaWhpbnRlYWpobmp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI4MTMsImV4cCI6MjA3MDYxODgxM30.KrSQYsOzPPhErffzdLzMS_4pC2reuONNc134tdtVPbA"}'::jsonb,
        body:='{"monitor": true}'::jsonb
    ) as request_id;
  $$
);