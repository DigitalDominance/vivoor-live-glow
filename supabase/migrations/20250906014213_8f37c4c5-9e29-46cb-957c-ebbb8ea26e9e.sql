-- Create clips bucket if it doesn't exist with 200MB limit
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('clips', 'clips', true, 209715200)
ON CONFLICT (id) 
DO UPDATE SET file_size_limit = 209715200;

-- Also ensure there are no restrictive RLS policies limiting file size
-- Check if there are any storage policies that might be causing issues