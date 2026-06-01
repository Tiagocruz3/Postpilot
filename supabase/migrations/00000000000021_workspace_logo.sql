-- Brand logo for workspace — shown as the avatar in platform post previews.
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS logo_url TEXT;
