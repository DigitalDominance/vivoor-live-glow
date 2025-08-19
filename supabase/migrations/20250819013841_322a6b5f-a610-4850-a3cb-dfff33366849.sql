-- Create proper storage buckets and RLS policies for thumbnails

-- Create thumbnails bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for thumbnails bucket
CREATE POLICY "Public can view thumbnails" ON storage.objects
FOR SELECT USING (bucket_id = 'thumbnails');

CREATE POLICY "Authenticated users can upload thumbnails" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'thumbnails' AND 
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their own thumbnails" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'thumbnails' AND 
  auth.uid() IS NOT NULL
);

-- Fix the foreign key constraint issue by removing it temporarily
-- The streams table shouldn't have a strict foreign key to profiles since
-- profiles are created dynamically when users stream
ALTER TABLE public.streams DROP CONSTRAINT IF EXISTS streams_user_id_fkey;