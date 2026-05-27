-- Allow workspace owners (not only workspace_members rows) to read/write AI vault media.

DROP POLICY IF EXISTS "workspace_ai_media_select_member" ON public.workspace_ai_media;
DROP POLICY IF EXISTS "workspace_ai_media_insert_member" ON public.workspace_ai_media;
DROP POLICY IF EXISTS "workspace_ai_media_delete_member" ON public.workspace_ai_media;

CREATE POLICY "workspace_ai_media_select_member" ON public.workspace_ai_media
  FOR SELECT
  USING (
    public.user_has_workspace_access(workspace_id)
    OR public.user_owns_workspace(workspace_id)
  );

CREATE POLICY "workspace_ai_media_insert_member" ON public.workspace_ai_media
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.user_has_workspace_access(workspace_id)
      OR public.user_owns_workspace(workspace_id)
    )
  );

CREATE POLICY "workspace_ai_media_delete_member" ON public.workspace_ai_media
  FOR DELETE
  USING (
    public.user_has_workspace_access(workspace_id)
    OR public.user_owns_workspace(workspace_id)
  );

CREATE OR REPLACE FUNCTION public.is_workspace_storage_member(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.user_has_workspace_access(public.storage_workspace_id(object_name))
    OR public.user_owns_workspace(public.storage_workspace_id(object_name));
$$;
