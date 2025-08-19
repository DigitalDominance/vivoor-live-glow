-- Add livepeer_stream_id column to streams table for proper API monitoring
ALTER TABLE public.streams ADD COLUMN livepeer_stream_id TEXT;

-- Create index for efficient lookups
CREATE INDEX idx_streams_livepeer_stream_id ON public.streams(livepeer_stream_id);