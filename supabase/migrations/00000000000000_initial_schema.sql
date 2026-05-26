-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace members
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- User roles (separate from profiles)
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION has_role(user_uuid UUID, role_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid AND role = role_name
  );
END;
$$;

-- User integrations (encrypted tokens)
CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Planner tasks
CREATE TABLE IF NOT EXISTS planner_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  kind TEXT NOT NULL DEFAULT 'post' CHECK (kind IN ('post', 'ad', 'event')),
  platform TEXT,
  link_url TEXT,
  color TEXT,
  external_source TEXT,
  external_id TEXT,
  external_calendar_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled posts
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  planner_task_id UUID NOT NULL REFERENCES planner_tasks(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  media_urls TEXT[],
  published_at TIMESTAMPTZ,
  published_url TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meta ads onboarding
CREATE TABLE IF NOT EXISTS meta_ads_onboarding (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  answers JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, workspace_id)
);

-- RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ads_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid());

CREATE POLICY "workspaces_select_member" ON workspaces FOR SELECT USING (
  EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = id AND user_id = auth.uid())
);
CREATE POLICY "workspaces_insert_owner" ON workspaces FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "workspaces_update_owner" ON workspaces FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "workspace_members_select_own" ON workspace_members FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "workspace_members_insert_owner" ON workspace_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_id AND owner_id = auth.uid())
);

CREATE POLICY "user_roles_select_own" ON user_roles FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "integrations_select_own" ON user_integrations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "integrations_insert_own" ON user_integrations FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "integrations_delete_own" ON user_integrations FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "planner_tasks_select_member" ON planner_tasks FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM workspace_members WHERE workspace_id = planner_tasks.workspace_id AND user_id = auth.uid()
  )
);
CREATE POLICY "planner_tasks_insert_member" ON planner_tasks FOR INSERT WITH CHECK (
  user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM workspace_members WHERE workspace_id = planner_tasks.workspace_id AND user_id = auth.uid()
  )
);
CREATE POLICY "planner_tasks_update_member" ON planner_tasks FOR UPDATE USING (
  user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM workspace_members WHERE workspace_id = planner_tasks.workspace_id AND user_id = auth.uid()
  )
);
CREATE POLICY "planner_tasks_delete_member" ON planner_tasks FOR DELETE USING (
  user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM workspace_members WHERE workspace_id = planner_tasks.workspace_id AND user_id = auth.uid()
  )
);

CREATE POLICY "scheduled_posts_select_member" ON scheduled_posts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM planner_tasks WHERE id = scheduled_posts.planner_task_id AND (
      user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM workspace_members WHERE workspace_id = planner_tasks.workspace_id AND user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "meta_ads_onboarding_select_own" ON meta_ads_onboarding FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "meta_ads_onboarding_insert_own" ON meta_ads_onboarding FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "meta_ads_onboarding_update_own" ON meta_ads_onboarding FOR UPDATE USING (user_id = auth.uid());

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, new.raw_user_meta_data->>'display_name');
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for media
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "media_select_public" ON storage.objects FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "media_insert_authenticated" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');
