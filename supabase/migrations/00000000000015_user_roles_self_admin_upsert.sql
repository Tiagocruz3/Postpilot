-- Allow authenticated users to upsert their own row in user_roles.
-- The CreditContext upserts {user_id: auth.uid(), role: 'admin'} for emails
-- on the platform admin allow-list. Without INSERT/UPDATE policies the
-- upsert returns 403, polluting the console even though the rest of the
-- bootstrap is wrapped in a try/catch.

-- INSERT policy: a user can insert their own (user_id, role) row.
DROP POLICY IF EXISTS "user_roles_insert_self" ON public.user_roles;
CREATE POLICY "user_roles_insert_self" ON public.user_roles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE policy: a user can update their own row.
DROP POLICY IF EXISTS "user_roles_update_self" ON public.user_roles;
CREATE POLICY "user_roles_update_self" ON public.user_roles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
