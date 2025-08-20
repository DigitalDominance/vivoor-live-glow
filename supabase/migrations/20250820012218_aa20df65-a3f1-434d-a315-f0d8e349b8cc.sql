-- Move pg_cron and pg_net extensions from public to extensions schema
-- First check what's in public schema
DO $$
BEGIN
  -- Create extensions schema if it doesn't exist
  CREATE SCHEMA IF NOT EXISTS extensions;
  
  -- Move pg_cron if it exists in public
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    ALTER EXTENSION pg_cron SET SCHEMA extensions;
  END IF;
  
  -- Move pg_net if it exists in public  
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    ALTER EXTENSION pg_net SET SCHEMA extensions;
  END IF;
END $$;