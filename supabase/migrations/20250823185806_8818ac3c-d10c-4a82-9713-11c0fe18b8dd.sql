-- Fix clip_likes RLS policy to allow wallet users to like clips
DROP POLICY IF EXISTS "Authenticated users can like clips" ON public.clip_likes;

CREATE POLICY "Wallet users can like clips" 
ON public.clip_likes 
FOR INSERT 
WITH CHECK (true);