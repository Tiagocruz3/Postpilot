-- Per-Facebook-Page isolation for the Ads Studio.
-- Each ad creative now records the Facebook Page it was created for so the
-- library, studio, and history can be scoped to the Page the user is posting
-- from. Existing rows keep a NULL page id and remain visible across all Pages
-- (legacy / unassigned) so nothing disappears after the migration.

ALTER TABLE ad_creatives
  ADD COLUMN IF NOT EXISTS facebook_page_id TEXT;

CREATE INDEX IF NOT EXISTS ad_creatives_workspace_page_idx
  ON ad_creatives(workspace_id, facebook_page_id, updated_at DESC);
