-- Page tenancy: allow planner_tasks and scheduled_posts to be scoped per
-- Facebook Page within a workspace.

ALTER TABLE planner_tasks ADD COLUMN IF NOT EXISTS facebook_page_id TEXT;
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS facebook_page_id TEXT;

-- Backfill existing planner_tasks to the workspace's currently-selected Page.
-- We try selected_page_id first (the explicit choice) then fall back to the
-- legacy page_id field. Rows in workspaces without a Facebook integration at
-- all remain NULL; they will be visible under every Page filter until
-- explicitly reassigned.
UPDATE planner_tasks pt
SET facebook_page_id = (
  SELECT COALESCE(
    NULLIF(ui.metadata->>'selected_page_id', ''),
    NULLIF(ui.metadata->>'page_id', '')
  )
  FROM user_integrations ui
  WHERE ui.workspace_id = pt.workspace_id
    AND ui.provider IN ('facebook', 'meta')
    AND COALESCE(
          NULLIF(ui.metadata->>'selected_page_id', ''),
          NULLIF(ui.metadata->>'page_id', '')
        ) IS NOT NULL
  ORDER BY ui.updated_at DESC
  LIMIT 1
)
WHERE pt.facebook_page_id IS NULL;

-- Mirror the page assignment down to scheduled_posts so the history view can
-- filter without always joining planner_tasks.
UPDATE scheduled_posts sp
SET facebook_page_id = pt.facebook_page_id
FROM planner_tasks pt
WHERE sp.planner_task_id = pt.id
  AND sp.facebook_page_id IS NULL
  AND pt.facebook_page_id IS NOT NULL;

-- Indexes for fast page-scoped calendar and history queries.
CREATE INDEX IF NOT EXISTS planner_tasks_workspace_page_idx
  ON planner_tasks (workspace_id, facebook_page_id, scheduled_at ASC);

CREATE INDEX IF NOT EXISTS scheduled_posts_page_idx
  ON scheduled_posts (facebook_page_id);
