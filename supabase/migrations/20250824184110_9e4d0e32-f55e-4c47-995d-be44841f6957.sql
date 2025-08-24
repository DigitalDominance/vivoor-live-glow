-- Add sender info fields to tips table
ALTER TABLE public.tips 
ADD COLUMN sender_name TEXT,
ADD COLUMN sender_avatar TEXT,
ADD COLUMN tip_message TEXT;