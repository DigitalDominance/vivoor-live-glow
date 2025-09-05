-- Increase file size limit for clips bucket to 100MB
UPDATE storage.buckets 
SET file_size_limit = 104857600  -- 100MB in bytes
WHERE id = 'clips';