-- Capture the live platform URL, post id, preview image, and engagement metrics
-- for each post that is published from the composer.

ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS platform_post_id TEXT,
  ADD COLUMN IF NOT EXISTS permalink_url TEXT,
  ADD COLUMN IF NOT EXISTS preview_image_url TEXT,
  ADD COLUMN IF NOT EXISTS metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metrics_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metrics_error TEXT;

CREATE INDEX IF NOT EXISTS scheduled_posts_published_at_idx
  ON public.scheduled_posts (published_at DESC);
