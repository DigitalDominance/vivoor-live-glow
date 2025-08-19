-- Set up automatic stream cleanup cron job (runs every 5 minutes)
SELECT cron.schedule(
  'cleanup-inactive-streams',
  '*/5 * * * *', -- every 5 minutes
  $$
  SELECT net.http_post(
      url:='https://qcowmxypihinteajhnjw.supabase.co/functions/v1/stream-cleanup',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjb3dteHlwaWhpbnRlYWpobmp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI4MTMsImV4cCI6MjA3MDYxODgxM30.KrSQYsOzPPhErffzdLzMS_4pC2reuONNc134tdtVPbA"}'::jsonb,
      body:='{"trigger": "cron"}'::jsonb
  ) as request_id;
  $$
);