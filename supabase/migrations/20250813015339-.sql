-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- VODs table
CREATE TABLE IF NOT EXISTS public.vods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  duration_seconds INTEGER,
  src_url TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on vods
ALTER TABLE public.vods ENABLE ROW LEVEL SECURITY;

-- Policies for vods (safe create)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vods' AND policyname='VODs are viewable by everyone'
  ) THEN
    CREATE POLICY "VODs are viewable by everyone"
    ON public.vods FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vods' AND policyname='Users can insert their own VODs'
  ) THEN
    CREATE POLICY "Users can insert their own VODs"
    ON public.vods FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vods' AND policyname='Users can update their own VODs'
  ) THEN
    CREATE POLICY "Users can update their own VODs"
    ON public.vods FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vods' AND policyname='Users can delete their own VODs'
  ) THEN
    CREATE POLICY "Users can delete their own VODs"
    ON public.vods FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Trigger for vods
DROP TRIGGER IF EXISTS update_vods_updated_at ON public.vods;
CREATE TRIGGER update_vods_updated_at
BEFORE UPDATE ON public.vods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Clips table
CREATE TABLE IF NOT EXISTS public.clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vod_id UUID NOT NULL REFERENCES public.vods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  start_seconds INTEGER NOT NULL,
  end_seconds INTEGER NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on clips
ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;

-- Policies for clips (safe create)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='clips' AND policyname='Clips are viewable by everyone'
  ) THEN
    CREATE POLICY "Clips are viewable by everyone"
    ON public.clips FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='clips' AND policyname='Users can insert their own clips'
  ) THEN
    CREATE POLICY "Users can insert their own clips"
    ON public.clips FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='clips' AND policyname='Users can update their own clips'
  ) THEN
    CREATE POLICY "Users can update their own clips"
    ON public.clips FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='clips' AND policyname='Users can delete their own clips'
  ) THEN
    CREATE POLICY "Users can delete their own clips"
    ON public.clips FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_clips_vod_id ON public.clips(vod_id);

-- Storage buckets for VODs and clips
INSERT INTO storage.buckets (id, name, public) VALUES ('vods', 'vods', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('clips', 'clips', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read; users manage their own files in user-id folder
DO $$ BEGIN
  -- Public can read VODs and Clips
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can view vods and clips'
  ) THEN
    CREATE POLICY "Public can view vods and clips"
    ON storage.objects FOR SELECT
    USING (bucket_id IN ('vods', 'clips'));
  END IF;

  -- Insert
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload to vods and clips in their folder'
  ) THEN
    CREATE POLICY "Users can upload to vods and clips in their folder"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id IN ('vods','clips')
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  -- Update
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update their vods and clips'
  ) THEN
    CREATE POLICY "Users can update their vods and clips"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id IN ('vods','clips')
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  -- Delete
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete their vods and clips'
  ) THEN
    CREATE POLICY "Users can delete their vods and clips"
    ON storage.objects FOR DELETE
    USING (
      bucket_id IN ('vods','clips')
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;