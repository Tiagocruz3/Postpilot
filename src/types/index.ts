import type { Json } from '@/types/database'

export type Platform = 'facebook' | 'linkedin' | 'x' | 'meta' | 'google'
export type PlannerPlatform = Platform | 'meta_ads'
export type IntegrationProvider = Platform
export type TaskStatus = 'draft' | 'scheduled' | 'published' | 'failed'
export type TaskKind = 'post' | 'ad' | 'event'
export type WorkspaceRole = 'owner' | 'admin' | 'member'

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  locale: string
  time_zone: string
  date_style: 'short' | 'medium' | 'long' | 'full'
  time_format: '12h' | '24h'
  created_at: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  owner_id: string
  created_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  created_at: string
}

export interface WorkspaceInvite {
  id: string
  workspace_id: string
  email: string
  role: Extract<WorkspaceRole, 'admin' | 'member'>
  invited_by: string
  created_at: string
  accepted_at: string | null
}

export interface WorkspaceSummary extends Workspace {
  membership_role: WorkspaceRole
  member_count: number
}

export type GoogleCalendarSelection = {
  [key: string]: Json | undefined
  id: string
  summary: string
  backgroundColor?: string
  selected?: boolean
}

export interface IntegrationMetadata {
  page_id?: string
  page_name?: string
  linkedin_id?: string
  handle?: string
  avatar?: string
  ad_account_id?: string
  sync_status?: 'idle' | 'healthy' | 'warning'
  last_synced_at?: string
  calendars?: GoogleCalendarSelection[]
  selected_calendar_ids?: string[]
  [key: string]: Json | undefined
}

export interface UserIntegration {
  id: string
  user_id: string
  workspace_id: string
  provider: IntegrationProvider
  access_token_encrypted: string
  token_iv: string
  refresh_token_encrypted: string | null
  expires_at: string | null
  metadata: IntegrationMetadata
  created_at: string
  updated_at: string
}

export interface PlannerTaskPayload {
  media?: string[]
  media_urls?: string[]
  link_url?: string
  source_prompt?: string
  [key: string]: Json | undefined
}

export interface PlannerTask {
  id: string
  user_id: string
  workspace_id: string
  title: string
  description: string | null
  scheduled_at: string
  duration_minutes: number
  status: TaskStatus
  kind: TaskKind
  platform: PlannerPlatform | null
  link_url: string | null
  color: string | null
  external_source: string | null
  external_id: string | null
  external_calendar_id: string | null
  payload: PlannerTaskPayload | null
  created_at: string
  updated_at: string
}

export interface ScheduledPost {
  id: string
  planner_task_id: string
  platform: PlannerPlatform
  content: string
  media_urls: string[] | null
  published_at: string | null
  published_url: string | null
  error: string | null
  created_at: string
}

export interface MetaAdsOnboarding {
  id: string
  user_id: string
  workspace_id: string
  answers: Json
  created_at: string
  updated_at: string
}

export interface WorkspaceAiSettings {
  id: string
  workspace_id: string
  updated_by: string
  content_provider: 'openrouter' | 'lmstudio'
  openrouter_api_key_encrypted: string | null
  openrouter_api_key_iv: string | null
  openrouter_content_model: string | null
  openrouter_image_model: string | null
  fal_api_key_encrypted: string | null
  fal_api_key_iv: string | null
  fal_video_model: string | null
  lmstudio_base_url: string
  lmstudio_content_model: string | null
  created_at: string
  updated_at: string
}

export interface AdVariant {
  headline: string
  primary_text: string
  description: string
  cta: string
  image_prompt: string
  image_url?: string
}

export type AiMediaType = 'image' | 'video'
export type AiMediaSource = 'compose' | 'ads' | 'other'

export type InspirationPlatform = 'facebook' | 'linkedin' | 'x' | 'instagram'

export interface CompetitorWatch {
  id: string
  workspace_id: string
  created_by: string
  platform: InspirationPlatform
  handle: string
  display_name: string | null
  niche: string | null
  created_at: string
}

export interface InspirationPost {
  id: string
  workspace_id: string
  watch_id: string | null
  created_by: string
  platform: InspirationPlatform
  account_handle: string
  post_text: string
  hashtags: string[]
  posted_at: string | null
  engagement: Json
  created_at: string
}

export interface WorkspaceAiMedia {
  id: string
  workspace_id: string
  created_by: string
  media_type: AiMediaType
  storage_bucket: string
  storage_path: string
  public_url: string
  prompt: string | null
  source: AiMediaSource
  metadata: Json
  created_at: string
}

export interface AdsStudioProfile {
  userId: string
  businessProfile: Json
  offerProfile: Json
  audienceProfile: Json
  brandVoice: Json
  leadDestination: Json
  creativePreferences: Json
  aiPreferences: Json
  metaConnection: Json
  completionScore: number
  createdAt: string
  updatedAt: string
}

export interface MetaAdDraft {
  id: string
  userId: string
  profileId: string | null
  status: 'draft' | 'ready' | 'launched'
  campaignName: string
  goal: string
  adType: string
  selectedOptionId: string | null
  brief: Json
  embeddedAi: Json
  adOptions: Json
  selectedAd: Json
  destination: Json
  audience: Json
  budget: Json
  placements: Json
  analytics: Json
  createdAt: string
  updatedAt: string
}

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  color?: string
  status: TaskStatus
  kind: TaskKind
  platform?: PlannerPlatform | null
  external?: boolean
}
