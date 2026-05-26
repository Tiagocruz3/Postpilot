ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en-AU',
  ADD COLUMN IF NOT EXISTS time_zone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS date_style TEXT NOT NULL DEFAULT 'medium'
    CHECK (date_style IN ('short', 'medium', 'long', 'full')),
  ADD COLUMN IF NOT EXISTS time_format TEXT NOT NULL DEFAULT '12h'
    CHECK (time_format IN ('12h', '24h'));

CREATE TABLE IF NOT EXISTS public.workspace_ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  updated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_provider TEXT NOT NULL DEFAULT 'openrouter'
    CHECK (content_provider IN ('openrouter', 'lmstudio')),
  openrouter_api_key_encrypted TEXT,
  openrouter_api_key_iv TEXT,
  openrouter_content_model TEXT,
  openrouter_image_model TEXT,
  fal_api_key_encrypted TEXT,
  fal_api_key_iv TEXT,
  fal_video_model TEXT,
  lmstudio_base_url TEXT NOT NULL DEFAULT 'http://127.0.0.1:1234/v1',
  lmstudio_content_model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id)
);

ALTER TABLE public.workspace_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_ai_settings_select_member" ON public.workspace_ai_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members
      WHERE workspace_id = workspace_ai_settings.workspace_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_ai_settings_insert_member" ON public.workspace_ai_settings
  FOR INSERT
  WITH CHECK (
    updated_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.workspace_members
      WHERE workspace_id = workspace_ai_settings.workspace_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_ai_settings_update_member" ON public.workspace_ai_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members
      WHERE workspace_id = workspace_ai_settings.workspace_id
        AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    updated_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.workspace_members
      WHERE workspace_id = workspace_ai_settings.workspace_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_ai_settings_delete_member" ON public.workspace_ai_settings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members
      WHERE workspace_id = workspace_ai_settings.workspace_id
        AND user_id = auth.uid()
    )
  );
