-- Add Livepeer-specific columns to clips table
ALTER TABLE public.clips 
ADD COLUMN IF NOT EXISTS livepeer_asset_id text,
ADD COLUMN IF NOT EXISTS download_url text,
ADD COLUMN IF NOT EXISTS playback_id text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clips_livepeer_asset_id ON public.clips(livepeer_asset_id);
CREATE INDEX IF NOT EXISTS idx_clips_playback_id ON public.clips(playback_id);