-- Fix clips table foreign key constraint - make vod_id nullable since clips can be created from live streams
ALTER TABLE public.clips ALTER COLUMN vod_id DROP NOT NULL;

-- Add a check constraint to ensure either vod_id is provided (for VOD clips) or we have a live stream
-- We'll handle this validation in the application logic instead for flexibility