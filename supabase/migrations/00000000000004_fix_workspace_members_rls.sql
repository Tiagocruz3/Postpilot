-- workspace_members_select_member referenced workspace_members inside its own
-- USING clause, causing "infinite recursion detected in policy" and HTTP 500s.

CREATE OR REPLACE FUNCTION public.user_has_workspace_access(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "workspace_members_select_member" ON public.workspace_members;
CREATE POLICY "workspace_members_select_member" ON public.workspace_members
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "workspaces_select_member" ON public.workspaces;
CREATE POLICY "workspaces_select_member" ON public.workspaces
  FOR SELECT
  USING (public.user_has_workspace_access(id));
