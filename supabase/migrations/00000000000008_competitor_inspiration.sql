-- Competitor Watch + Inspiration Feed (workspace-scoped)

CREATE TABLE IF NOT EXISTS public.workspace_competitor_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'linkedin', 'x', 'instagram')),
  handle TEXT NOT NULL,
  display_name TEXT,
  niche TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_competitor_watches_workspace_idx
  ON public.workspace_competitor_watches (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.workspace_inspiration_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  watch_id UUID REFERENCES public.workspace_competitor_watches(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'linkedin', 'x', 'instagram')),
  account_handle TEXT NOT NULL DEFAULT '',
  post_text TEXT NOT NULL,
  hashtags TEXT[] DEFAULT '{}',
  posted_at TIMESTAMPTZ,
  engagement JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_inspiration_posts_workspace_idx
  ON public.workspace_inspiration_posts (workspace_id, created_at DESC);

ALTER TABLE public.workspace_competitor_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_inspiration_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "competitor_watches_select_member" ON public.workspace_competitor_watches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = workspace_competitor_watches.workspace_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "competitor_watches_insert_member" ON public.workspace_competitor_watches
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = workspace_competitor_watches.workspace_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "competitor_watches_delete_member" ON public.workspace_competitor_watches
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = workspace_competitor_watches.workspace_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "inspiration_posts_select_member" ON public.workspace_inspiration_posts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = workspace_inspiration_posts.workspace_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "inspiration_posts_insert_member" ON public.workspace_inspiration_posts
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = workspace_inspiration_posts.workspace_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "inspiration_posts_delete_member" ON public.workspace_inspiration_posts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = workspace_inspiration_posts.workspace_id AND user_id = auth.uid()
    )
  );
