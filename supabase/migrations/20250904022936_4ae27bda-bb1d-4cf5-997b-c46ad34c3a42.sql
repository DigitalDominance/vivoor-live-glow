-- Add stream_type column to streams table to differentiate between browser and livepeer streams
ALTER TABLE public.streams 
ADD COLUMN IF NOT EXISTS stream_type TEXT DEFAULT 'livepeer';

-- Add index for better performance when filtering by stream type
CREATE INDEX IF NOT EXISTS idx_streams_stream_type ON public.streams(stream_type);