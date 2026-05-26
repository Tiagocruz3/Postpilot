-- Team seats: invites by email + co-member visibility

CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  CONSTRAINT workspace_invites_email_normalized CHECK (email = lower(email)),
  UNIQUE (workspace_id, email)
);

CREATE INDEX IF NOT EXISTS workspace_invites_email_pending_idx
  ON public.workspace_invites (lower(email))
  WHERE accepted_at IS NULL;

CREATE OR REPLACE FUNCTION public.user_is_workspace_admin(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.workspaces
      WHERE id = p_workspace_id
        AND owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members
      WHERE workspace_id = p_workspace_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    );
$$;

CREATE OR REPLACE FUNCTION public.users_share_a_workspace(p_peer_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members AS mine
    JOIN public.workspace_members AS theirs
      ON mine.workspace_id = theirs.workspace_id
    WHERE mine.user_id = auth.uid()
      AND theirs.user_id = p_peer_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
STABLE
AS $$
  SELECT id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_auth_user_id_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_user_id_by_email(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.accept_my_workspace_invites()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_email TEXT;
  v_count INTEGER := 0;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  SELECT wi.workspace_id, auth.uid(), wi.role
  FROM public.workspace_invites AS wi
  WHERE lower(wi.email) = lower(v_email)
    AND wi.accepted_at IS NULL
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.workspace_invites
  SET accepted_at = NOW()
  WHERE lower(email) = lower(v_email)
    AND accepted_at IS NULL;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_my_workspace_invites() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  SELECT wi.workspace_id, NEW.id, wi.role
  FROM public.workspace_invites AS wi
  WHERE lower(wi.email) = lower(NEW.email)
    AND wi.accepted_at IS NULL
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  UPDATE public.workspace_invites
  SET accepted_at = NOW()
  WHERE lower(email) = lower(NEW.email)
    AND accepted_at IS NULL;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "workspace_members_select_member" ON public.workspace_members;
CREATE POLICY "workspace_members_select_workspace" ON public.workspace_members
  FOR SELECT
  USING (public.user_has_workspace_access(workspace_id));

DROP POLICY IF EXISTS "workspace_members_insert_owner" ON public.workspace_members;
CREATE POLICY "workspace_members_insert_bootstrap" ON public.workspace_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.user_owns_workspace(workspace_id)
  );

DROP POLICY IF EXISTS "workspace_members_delete_admin" ON public.workspace_members;
CREATE POLICY "workspace_members_delete_admin" ON public.workspace_members
  FOR DELETE
  USING (
    public.user_is_workspace_admin(workspace_id)
    AND role <> 'owner'
  );

DROP POLICY IF EXISTS "profiles_select_workspace_peer" ON public.profiles;
CREATE POLICY "profiles_select_workspace_peer" ON public.profiles
  FOR SELECT
  USING (public.users_share_a_workspace(id));

ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_invites_select_admin" ON public.workspace_invites
  FOR SELECT
  USING (public.user_is_workspace_admin(workspace_id));

CREATE POLICY "workspace_invites_delete_admin" ON public.workspace_invites
  FOR DELETE
  USING (public.user_is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "workspaces_delete_owner" ON public.workspaces;
CREATE POLICY "workspaces_delete_owner" ON public.workspaces
  FOR DELETE
  USING (owner_id = auth.uid());
