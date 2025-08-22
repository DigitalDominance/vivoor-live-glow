/*
  # Add clip likes functionality

  1. New Tables
    - `clip_likes`
      - `id` (uuid, primary key)
      - `clip_id` (uuid, foreign key to clips)
      - `user_id` (text, foreign key to profiles)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `clip_likes` table
    - Add policies for authenticated users to manage their likes
    - Add policy for anyone to view clip likes

  3. Indexes
    - Add index on clip_id for efficient like counting
    - Add unique constraint on (clip_id, user_id) to prevent duplicate likes
*/

-- Create clip_likes table
CREATE TABLE IF NOT EXISTS clip_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id uuid NOT NULL,
  user_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(clip_id, user_id)
);

-- Add foreign key constraint to clips table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'clip_likes_clip_id_fkey'
  ) THEN
    ALTER TABLE clip_likes ADD CONSTRAINT clip_likes_clip_id_fkey 
    FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE clip_likes ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Anyone can view clip likes"
  ON clip_likes
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can like clips"
  ON clip_likes
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can unlike their own likes"
  ON clip_likes
  FOR DELETE
  TO public
  USING (auth.uid()::text = user_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_clip_likes_clip_id ON clip_likes(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_likes_user_id ON clip_likes(user_id);