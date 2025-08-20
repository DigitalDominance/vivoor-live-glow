-- Drop the foreign key constraint entirely since clips can be created from live streams without VODs
ALTER TABLE public.clips DROP CONSTRAINT IF EXISTS clips_vod_id_fkey;

-- Add a check to ensure we have either a vod_id or we're creating from a live stream
-- But make it flexible in application logic rather than database constraints