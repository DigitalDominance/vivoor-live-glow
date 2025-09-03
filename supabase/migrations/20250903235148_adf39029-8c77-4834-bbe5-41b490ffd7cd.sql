-- Add streaming mode and playback ID columns to streams table
ALTER TABLE public.streams 
ADD COLUMN streaming_mode TEXT DEFAULT 'rtmp' CHECK (streaming_mode IN ('rtmp', 'browser')),
ADD COLUMN livepeer_playback_id TEXT;