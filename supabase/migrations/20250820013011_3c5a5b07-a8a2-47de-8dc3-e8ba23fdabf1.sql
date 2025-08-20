-- Fix storage policies for wallet authentication
-- Replace the restrictive policies with ones that work for wallet auth

-- Drop existing policies that require auth.uid()
DROP POLICY IF EXISTS "Authenticated users can upload thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload thumbnails to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own thumbnails" ON storage.objects;

-- Create new policies that allow uploads without auth.uid() requirement
CREATE POLICY "Anyone can upload thumbnails" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'thumbnails');

CREATE POLICY "Anyone can update thumbnails" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'thumbnails');

CREATE POLICY "Anyone can delete thumbnails" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'thumbnails');