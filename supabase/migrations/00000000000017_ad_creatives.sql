-- Ad creatives table — backs the Ad Library, Ad History, and per-variant persistence.
-- Each row is one creative (one variant of an ad). Variants generated together share
-- the same `generation_id` so they can be grouped side-by-side in the UI.

CREATE TABLE IF NOT EXISTS ad_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Grouping & identity
  generation_id UUID,
  variant_label TEXT NOT NULL DEFAULT 'Variant A',
  campaign_name TEXT,
  is_selected_variant BOOLEAN NOT NULL DEFAULT FALSE,

  -- Lifecycle status. One of: ai_draft | draft | published | paused | completed | archived
  status TEXT NOT NULL DEFAULT 'ai_draft',
  source TEXT NOT NULL DEFAULT 'ai', -- 'ai' | 'manual'

  -- Creative copy
  angle TEXT,
  primary_text TEXT NOT NULL DEFAULT '',
  headline TEXT NOT NULL DEFAULT '',
  description TEXT,
  cta TEXT NOT NULL DEFAULT 'Learn More',

  -- Media
  media_url TEXT,
  media_type TEXT, -- 'image' | 'video'
  image_prompt TEXT,
  creative_direction TEXT,
  targeting_angle TEXT,

  -- Destination
  destination_url TEXT,
  destination_type TEXT, -- 'website' | 'meta_lead_form' | 'messenger' | ...

  -- Goal + placements
  goal TEXT,
  placements JSONB DEFAULT '[]'::jsonb,
  ad_format TEXT,

  -- Audience
  audience JSONB DEFAULT '{}'::jsonb,
  -- Shape: { location, age_min, age_max, genders, interests, behaviours, audience_size }

  -- Budget + schedule
  budget JSONB DEFAULT '{}'::jsonb,
  -- Shape: { type: 'daily'|'lifetime', daily, lifetime, duration_days }
  schedule_start DATE,
  schedule_end DATE,

  -- Estimated reach (last computed snapshot for quick library rendering)
  estimated_reach JSONB DEFAULT '{}'::jsonb,
  -- Shape: { min, max, audience_pool, currency }

  -- AI extras
  ai_recommendation JSONB DEFAULT '{}'::jsonb,
  -- Shape: { preferred_variant, reason } — denormalised per row for easy display

  -- External (Meta) identity once published
  meta_ad_id TEXT,
  meta_campaign_id TEXT,
  meta_adset_id TEXT,
  published_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ad_creatives_status_chk CHECK (
    status IN ('ai_draft', 'draft', 'published', 'paused', 'completed', 'archived')
  ),
  CONSTRAINT ad_creatives_source_chk CHECK (source IN ('ai', 'manual'))
);

CREATE INDEX IF NOT EXISTS ad_creatives_workspace_idx ON ad_creatives(workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS ad_creatives_workspace_status_idx ON ad_creatives(workspace_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS ad_creatives_generation_idx ON ad_creatives(generation_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION ad_creatives_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ad_creatives_updated_at_trg ON ad_creatives;
CREATE TRIGGER ad_creatives_updated_at_trg
  BEFORE UPDATE ON ad_creatives
  FOR EACH ROW
  EXECUTE FUNCTION ad_creatives_set_updated_at();

-- RLS
ALTER TABLE ad_creatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_creatives_select_member" ON ad_creatives;
CREATE POLICY "ad_creatives_select_member" ON ad_creatives
  FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = ad_creatives.workspace_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ad_creatives_insert_member" ON ad_creatives;
CREATE POLICY "ad_creatives_insert_member" ON ad_creatives
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = ad_creatives.workspace_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ad_creatives_update_member" ON ad_creatives;
CREATE POLICY "ad_creatives_update_member" ON ad_creatives
  FOR UPDATE USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = ad_creatives.workspace_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ad_creatives_delete_member" ON ad_creatives;
CREATE POLICY "ad_creatives_delete_member" ON ad_creatives
  FOR DELETE USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = ad_creatives.workspace_id AND user_id = auth.uid()
    )
  );
