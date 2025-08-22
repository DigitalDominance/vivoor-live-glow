/*
  # Add views column to clips table

  1. Changes
    - Add `views` column to `clips` table with default value of 0
    - Add index on views for sorting by popularity

  2. Notes
    - Views will be incremented when clips are watched
    - Default value ensures existing clips start with 0 views
*/

-- Add views column to clips table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clips' AND column_name = 'views'
  ) THEN
    ALTER TABLE clips ADD COLUMN views integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Add index for sorting by views
CREATE INDEX IF NOT EXISTS idx_clips_views ON clips(views DESC);

-- Update existing clips to have 0 views
UPDATE clips SET views = 0 WHERE views IS NULL;