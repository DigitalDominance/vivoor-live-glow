-- Create clip_likes table to track likes on clips
CREATE TABLE public.clip_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  clip_id UUID NOT NULL REFERENCES public.clips(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, clip_id)
);

-- Enable RLS
ALTER TABLE public.clip_likes ENABLE ROW LEVEL SECURITY;

-- Create policies for clip likes
CREATE POLICY "Anyone can view clip likes" 
ON public.clip_likes 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can like clips" 
ON public.clip_likes 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can unlike their own likes" 
ON public.clip_likes 
FOR DELETE 
USING (auth.uid()::text = user_id);

-- Add views column to clips table if it doesn't exist
ALTER TABLE public.clips 
ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;