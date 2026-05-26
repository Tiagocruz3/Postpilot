CREATE UNIQUE INDEX IF NOT EXISTS user_integrations_user_workspace_provider_idx
  ON public.user_integrations (user_id, workspace_id, provider);

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_slug_idx
  ON public.workspaces (slug);

DROP POLICY IF EXISTS "workspace_members_select_own" ON public.workspace_members;
CREATE POLICY "workspace_members_select_member" ON public.workspace_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members AS members
      WHERE members.workspace_id = workspace_members.workspace_id
        AND members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "integrations_select_own" ON public.user_integrations;
DROP POLICY IF EXISTS "integrations_insert_own" ON public.user_integrations;
DROP POLICY IF EXISTS "integrations_delete_own" ON public.user_integrations;

CREATE POLICY "integrations_select_member" ON public.user_integrations
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members
      WHERE workspace_id = user_integrations.workspace_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "integrations_insert_member" ON public.user_integrations
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members
      WHERE workspace_id = user_integrations.workspace_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "integrations_update_member" ON public.user_integrations
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members
      WHERE workspace_id = user_integrations.workspace_id
        AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members
      WHERE workspace_id = user_integrations.workspace_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "integrations_delete_member" ON public.user_integrations
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members
      WHERE workspace_id = user_integrations.workspace_id
        AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "scheduled_posts_select_member" ON public.scheduled_posts;

CREATE POLICY "scheduled_posts_select_member" ON public.scheduled_posts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.planner_tasks
      WHERE planner_tasks.id = scheduled_posts.planner_task_id
        AND (
          planner_tasks.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.workspace_members
            WHERE workspace_id = planner_tasks.workspace_id
              AND user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "scheduled_posts_insert_member" ON public.scheduled_posts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.planner_tasks
      WHERE planner_tasks.id = scheduled_posts.planner_task_id
        AND (
          planner_tasks.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.workspace_members
            WHERE workspace_id = planner_tasks.workspace_id
              AND user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "scheduled_posts_update_member" ON public.scheduled_posts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.planner_tasks
      WHERE planner_tasks.id = scheduled_posts.planner_task_id
        AND (
          planner_tasks.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.workspace_members
            WHERE workspace_id = planner_tasks.workspace_id
              AND user_id = auth.uid()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.planner_tasks
      WHERE planner_tasks.id = scheduled_posts.planner_task_id
        AND (
          planner_tasks.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.workspace_members
            WHERE workspace_id = planner_tasks.workspace_id
              AND user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "scheduled_posts_delete_member" ON public.scheduled_posts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.planner_tasks
      WHERE planner_tasks.id = scheduled_posts.planner_task_id
        AND (
          planner_tasks.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.workspace_members
            WHERE workspace_id = planner_tasks.workspace_id
              AND user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "meta_ads_onboarding_select_own" ON public.meta_ads_onboarding;
DROP POLICY IF EXISTS "meta_ads_onboarding_insert_own" ON public.meta_ads_onboarding;
DROP POLICY IF EXISTS "meta_ads_onboarding_update_own" ON public.meta_ads_onboarding;

CREATE POLICY "meta_ads_onboarding_select_member" ON public.meta_ads_onboarding
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members
      WHERE workspace_id = meta_ads_onboarding.workspace_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "meta_ads_onboarding_insert_member" ON public.meta_ads_onboarding
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members
      WHERE workspace_id = meta_ads_onboarding.workspace_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "meta_ads_onboarding_update_member" ON public.meta_ads_onboarding
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members
      WHERE workspace_id = meta_ads_onboarding.workspace_id
        AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members
      WHERE workspace_id = meta_ads_onboarding.workspace_id
        AND user_id = auth.uid()
    )
  );
