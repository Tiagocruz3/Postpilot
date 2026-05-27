-- Ensure realtime works for tables we subscribe to from the client.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime FOR TABLE
      public.workspace_ai_media,
      public.planner_tasks,
      public.scheduled_posts,
      public.user_integrations;
    RETURN;
  END IF;
END$$;

-- Add each table individually; ignore if already present.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_ai_media;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.planner_tasks;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_posts;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_integrations;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END$$;
