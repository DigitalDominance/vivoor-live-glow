-- Fix the thumbnails bucket storage policies to allow proper banner uploads
-- The user_id folder structure should match the RLS policy requirements

-- Update the storage RLS policies for thumbnails bucket to use proper path matching
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can upload thumbnails to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view all thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own thumbnails" ON storage.objects;

-- Create updated policies that match the file path structure we're using
CREATE POLICY "Users can upload thumbnails to their own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'thumbnails' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view all thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'thumbnails');

CREATE POLICY "Users can update their own thumbnails"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'thumbnails' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own thumbnails"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'thumbnails' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);