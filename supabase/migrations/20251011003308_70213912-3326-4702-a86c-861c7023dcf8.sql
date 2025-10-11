-- Remove the hourly cron job
SELECT cron.unschedule('verify-kns-domains-hourly');

-- Add kns_verified_timestamp to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS kns_last_verified_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_kns_verified 
ON public.profiles(id, kns_last_verified_at) 
WHERE show_kns_badge = true;