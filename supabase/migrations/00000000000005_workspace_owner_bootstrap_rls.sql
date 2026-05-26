-- Owners must read their workspace before a workspace_members row exists (insert ... select=*).
-- workspace_members INSERT must not depend on a workspaces SELECT blocked by RLS.

CREATE OR REPLACE FUNCTION public.user_owns_workspace(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces
    WHERE id = p_workspace_id
      AND owner_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "workspaces_select_member" ON public.workspaces;
CREATE POLICY "workspaces_select_member" ON public.workspaces
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR public.user_has_workspace_access(id)
  );

DROP POLICY IF EXISTS "workspace_members_insert_owner" ON public.workspace_members;
CREATE POLICY "workspace_members_insert_owner" ON public.workspace_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.user_owns_workspace(workspace_id)
  );
