-- Add policy to allow viewing tips for live streams
CREATE POLICY "Anyone can view tips for live streams" 
ON public.tips 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.streams s 
    WHERE s.id = tips.stream_id 
    AND s.is_live = true
  )
);