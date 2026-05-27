import type { User } from '@supabase/supabase-js'
import { Profile, Workspace, PlannerTask } from '@/types'

export const isDemoMode = import.meta.env.VITE_ENABLE_DEMO === 'true'

export const demoUser = {
  id: 'demo-user-id',
  email: 'demo@adguru.app',
} as User

export const demoProfile: Profile = {
  id: 'demo-user-id',
  display_name: 'Demo User',
  avatar_url: null,
  locale: 'en-AU',
  time_zone: 'Australia/Brisbane',
  date_style: 'medium',
  time_format: '12h',
  created_at: new Date().toISOString(),
}

export const demoWorkspaces: Workspace[] = [
  {
    id: 'demo-ws-1',
    name: 'Acme Marketing',
    slug: 'acme-marketing',
    owner_id: 'demo-user-id',
    created_at: new Date().toISOString(),
  },
]

const now = new Date()
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0)

export const demoTasks: PlannerTask[] = [
  {
    id: 'task-1',
    user_id: 'demo-user-id',
    workspace_id: 'demo-ws-1',
    title: 'LinkedIn post: Q1 wins',
    description: 'Celebrating our biggest Q1 yet 🚀',
    scheduled_at: new Date(todayStart.getTime() + 60 * 60 * 1000).toISOString(),
    duration_minutes: 60,
    status: 'scheduled',
    kind: 'post',
    platform: 'linkedin',
    link_url: null,
    color: '#0A66C2',
    external_source: null,
    external_id: null,
    external_calendar_id: null,
    payload: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'task-2',
    user_id: 'demo-user-id',
    workspace_id: 'demo-ws-1',
    title: 'Facebook product launch',
    description: 'New feature drop announcement',
    scheduled_at: new Date(todayStart.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    duration_minutes: 60,
    status: 'draft',
    kind: 'post',
    platform: 'facebook',
    link_url: null,
    color: '#1877F2',
    external_source: null,
    external_id: null,
    external_calendar_id: null,
    payload: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'task-3',
    user_id: 'demo-user-id',
    workspace_id: 'demo-ws-1',
    title: 'X thread: tips & tricks',
    description: '5 tips for better social media scheduling',
    scheduled_at: new Date(todayStart.getTime() + 5 * 60 * 60 * 1000).toISOString(),
    duration_minutes: 60,
    status: 'published',
    kind: 'post',
    platform: 'x',
    link_url: 'https://x.com/demo/status/123',
    color: '#000000',
    external_source: null,
    external_id: null,
    external_calendar_id: null,
    payload: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'task-4',
    user_id: 'demo-user-id',
    workspace_id: 'demo-ws-1',
    title: 'Meta Ads campaign review',
    description: 'Review paused ad performance',
    scheduled_at: new Date(todayStart.getTime() + 7 * 60 * 60 * 1000).toISOString(),
    duration_minutes: 60,
    status: 'draft',
    kind: 'ad',
    platform: 'meta_ads',
    link_url: null,
    color: '#F02849',
    external_source: null,
    external_id: null,
    external_calendar_id: null,
    payload: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]
