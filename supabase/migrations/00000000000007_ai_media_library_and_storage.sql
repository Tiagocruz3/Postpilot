-- Workspace-scoped AI media library (images + videos generated across the app)

CREATE TABLE IF NOT EXISTS public.workspace_ai_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  storage_bucket TEXT NOT NULL DEFAULT 'ai_library',
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  prompt TEXT,
  source TEXT NOT NULL DEFAULT 'compose' CHECK (source IN ('compose', 'ads', 'other')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_ai_media_workspace_type_idx
  ON public.workspace_ai_media (workspace_id, media_type, created_at DESC);

CREATE INDEX IF NOT EXISTS workspace_ai_media_created_by_idx
  ON public.workspace_ai_media (created_by, created_at DESC);

ALTER TABLE public.workspace_ai_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_ai_media_select_member" ON public.workspace_ai_media;
DROP POLICY IF EXISTS "workspace_ai_media_insert_member" ON public.workspace_ai_media;
DROP POLICY IF EXISTS "workspace_ai_media_delete_member" ON public.workspace_ai_media;

CREATE POLICY "workspace_ai_media_select_member" ON public.workspace_ai_media
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members
      WHERE workspace_id = workspace_ai_media.workspace_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_ai_media_insert_member" ON public.workspace_ai_media
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.workspace_members
      WHERE workspace_id = workspace_ai_media.workspace_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_ai_media_delete_member" ON public.workspace_ai_media
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members
      WHERE workspace_id = workspace_ai_media.workspace_id
        AND user_id = auth.uid()
    )
  );

-- Storage helpers for workspace isolation
CREATE OR REPLACE FUNCTION public.storage_workspace_id(object_name text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF((string_to_array(object_name, '/'))[1], '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_storage_member(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = public.storage_workspace_id(object_name)
      AND user_id = auth.uid()
  );
$$;

-- AI library bucket (workspace / user paths)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai_library', 'ai_library', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "media_select_public" ON storage.objects;
DROP POLICY IF EXISTS "media_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "media_select_workspace_member" ON storage.objects;
DROP POLICY IF EXISTS "media_insert_workspace_member" ON storage.objects;
DROP POLICY IF EXISTS "media_delete_workspace_member" ON storage.objects;
DROP POLICY IF EXISTS "ai_library_select_workspace_member" ON storage.objects;
DROP POLICY IF EXISTS "ai_library_insert_workspace_member" ON storage.objects;
DROP POLICY IF EXISTS "ai_library_delete_workspace_member" ON storage.objects;

CREATE POLICY "media_select_workspace_member" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'media'
    AND public.is_workspace_storage_member(name)
  );

CREATE POLICY "media_insert_workspace_member" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'media'
    AND auth.role() = 'authenticated'
    AND public.is_workspace_storage_member(name)
  );

CREATE POLICY "media_delete_workspace_member" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'media'
    AND public.is_workspace_storage_member(name)
  );

CREATE POLICY "ai_library_select_workspace_member" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'ai_library'
    AND public.is_workspace_storage_member(name)
  );

CREATE POLICY "ai_library_insert_workspace_member" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'ai_library'
    AND auth.role() = 'authenticated'
    AND public.is_workspace_storage_member(name)
    AND (string_to_array(name, '/'))[2] = auth.uid()::text
  );

CREATE POLICY "ai_library_delete_workspace_member" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'ai_library'
    AND public.is_workspace_storage_member(name)
  );
