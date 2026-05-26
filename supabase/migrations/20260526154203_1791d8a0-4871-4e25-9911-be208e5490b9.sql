ALTER TABLE public.annonces REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.annonces;