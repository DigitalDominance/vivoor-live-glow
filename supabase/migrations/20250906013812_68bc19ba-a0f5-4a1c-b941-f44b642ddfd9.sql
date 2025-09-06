-- Update storage bucket to allow 200MB file uploads
UPDATE storage.buckets 
SET file_size_limit = 209715200  -- 200MB in bytes (200 * 1024 * 1024)
WHERE id = 'clips';

-- Also update any other relevant buckets that might store large files
UPDATE storage.buckets 
SET file_size_limit = 209715200  -- 200MB in bytes
WHERE id IN ('avatars', 'banners', 'thumbnails', 'uploads');