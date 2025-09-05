-- Add tips table to realtime publication for tip notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.tips;

-- Set replica identity to full to capture complete row data during updates
ALTER TABLE public.tips REPLICA IDENTITY FULL;