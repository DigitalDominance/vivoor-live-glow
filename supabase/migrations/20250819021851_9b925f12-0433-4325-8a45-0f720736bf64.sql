-- Create likes table for stream likes
CREATE TABLE public.likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  stream_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, stream_id)
);

-- Create follows table for user follows
CREATE TABLE public.follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id TEXT NOT NULL,
  following_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- Enable RLS on both tables
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- RLS policies for likes
CREATE POLICY "Users can view all likes" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own likes" ON public.likes FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can delete their own likes" ON public.likes FOR DELETE USING (auth.uid()::text = user_id);

-- RLS policies for follows
CREATE POLICY "Users can view all follows" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can insert their own follows" ON public.follows FOR INSERT WITH CHECK (auth.uid()::text = follower_id);
CREATE POLICY "Users can delete their own follows" ON public.follows FOR DELETE USING (auth.uid()::text = follower_id);

-- Functions to get like count for a stream
CREATE OR REPLACE FUNCTION public.get_stream_like_count(stream_id_param UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::INTEGER FROM public.likes WHERE stream_id = stream_id_param;
$$;

-- Function to check if user likes a stream
CREATE OR REPLACE FUNCTION public.user_likes_stream(stream_id_param UUID, user_id_param TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS(SELECT 1 FROM public.likes WHERE stream_id = stream_id_param AND user_id = user_id_param);
$$;

-- Function to get follower count for a user
CREATE OR REPLACE FUNCTION public.get_follower_count(user_id_param TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::INTEGER FROM public.follows WHERE following_id = user_id_param;
$$;

-- Function to get following count for a user
CREATE OR REPLACE FUNCTION public.get_following_count(user_id_param TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::INTEGER FROM public.follows WHERE follower_id = user_id_param;
$$;

-- Function to check if user follows another user
CREATE OR REPLACE FUNCTION public.user_follows_user(follower_id_param TEXT, following_id_param TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS(SELECT 1 FROM public.follows WHERE follower_id = follower_id_param AND following_id = following_id_param);
$$;

-- Update the streams function to include likes
CREATE OR REPLACE FUNCTION public.get_streams_with_profiles_and_likes(_limit integer DEFAULT 50, _offset integer DEFAULT 0)
RETURNS TABLE(
  id uuid, 
  title text, 
  category text, 
  is_live boolean, 
  viewers integer, 
  user_id text, 
  thumbnail_url text, 
  created_at timestamp with time zone, 
  profile_handle text, 
  profile_display_name text, 
  profile_avatar_url text,
  like_count integer,
  playback_url text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    s.id,
    s.title,
    s.category,
    s.is_live,
    s.viewers,
    s.user_id,
    s.thumbnail_url,
    s.created_at,
    p.handle as profile_handle,
    p.display_name as profile_display_name,
    p.avatar_url as profile_avatar_url,
    COALESCE((SELECT COUNT(*)::integer FROM public.likes l WHERE l.stream_id = s.id), 0) as like_count,
    s.playback_url
  FROM public.streams s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  ORDER BY s.created_at DESC
  LIMIT LEAST(GREATEST(_limit, 0), 100)
  OFFSET GREATEST(_offset, 0)
$$;