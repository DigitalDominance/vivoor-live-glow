-- Add foreign key constraint between streams and profiles
ALTER TABLE public.streams 
ADD CONSTRAINT streams_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Create index for better performance on user_id lookups
CREATE INDEX IF NOT EXISTS idx_streams_user_id ON public.streams(user_id);
CREATE INDEX IF NOT EXISTS idx_streams_is_live ON public.streams(is_live);
CREATE INDEX IF NOT EXISTS idx_streams_created_at ON public.streams(created_at);