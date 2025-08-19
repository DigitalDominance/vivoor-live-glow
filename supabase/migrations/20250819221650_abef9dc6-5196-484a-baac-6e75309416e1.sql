-- Fix cron job with correct syntax
SELECT cron.unschedule('monitor-livepeer-streams');
SELECT cron.schedule(
  'monitor-livepeer-streams',
  '* * * * *', -- every minute
  $$
  select
    net.http_post(
        url:='https://qcowmxypihinteajhnjw.supabase.co/functions/v1/stream-monitor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjb3dteHlwaWhpbnRlYWpobmp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI4MTMsImV4cCI6MjA3MDYxODgxM30.KrSQYsOzPPhErffzdLzMS_4pC2reuONNc134tdtVPbA"}'::jsonb,
        body:='{"monitor": true}'::jsonb
    ) as request_id;
  $$
);