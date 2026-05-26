import { supabase } from '@/lib/supabase'
import type { ComposePlatform } from '@/lib/compose-copy'

export interface ResearchSource {
  title: string
  url: string
}

export interface ResearchReport {
  summary: string
  trending_angles: string[]
  recommended_post_idea: string
  hooks: string[]
  caption_draft: string
  hashtags: string[]
  visual_idea: string
  suggested_posting_time: string
  sources: ResearchSource[]
}

export interface RemixReport {
  original_post_summary: string
  why_it_works: string
  content_structure: string
  brand_safe_version: string
  hooks: string[]
  caption: string
  cta: string
  hashtags: string[]
  visual_idea: string
  recommended_schedule_time: string
}

export interface ResearchFormValues {
  topic: string
  niche: string
  target_audience: string
  tone: string
  post_goal: string
  location: string
  web_search: boolean
}

export interface RemixFormValues {
  original_post_text: string
  competitor_niche: string
  user_niche: string
  target_audience: string
  tone: string
  offer: string
  post_goal: string
}

export const DEFAULT_RESEARCH_FORM: ResearchFormValues = {
  topic: '',
  niche: '',
  target_audience: '',
  tone: 'Professional and friendly',
  post_goal: 'Engagement and awareness',
  location: '',
  web_search: true,
}

export const DEFAULT_REMIX_FORM: RemixFormValues = {
  original_post_text: '',
  competitor_niche: '',
  user_niche: '',
  target_audience: '',
  tone: 'Professional and friendly',
  offer: '',
  post_goal: 'Engagement',
}

export async function invokeEdge<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, { body })
  if (error) {
    throw new Error(error.message)
  }
  const payload = data as T & { error?: string }
  if (payload && typeof payload === 'object' && 'error' in payload && payload.error) {
    throw new Error(payload.error)
  }
  return data as T
}

export function researchPost(
  platform: ComposePlatform,
  brandName: string,
  values: ResearchFormValues,
  workspaceId?: string | null,
) {
  return invokeEdge<{ report: ResearchReport }>('research-post', {
    platform,
    brand_name: brandName,
    topic: values.topic,
    niche: values.niche,
    target_audience: values.target_audience,
    tone: values.tone,
    post_goal: values.post_goal,
    location: values.location || undefined,
    web_search: values.web_search,
    workspace_id: workspaceId || undefined,
  })
}

export function remixInspiration(
  platform: ComposePlatform,
  brandName: string,
  values: RemixFormValues,
  workspaceId?: string | null,
) {
  return invokeEdge<{ report: RemixReport }>('remix-inspiration', {
    platform,
    brand_name: brandName,
    original_post_text: values.original_post_text,
    competitor_niche: values.competitor_niche,
    user_niche: values.user_niche,
    target_audience: values.target_audience,
    tone: values.tone,
    offer: values.offer,
    post_goal: values.post_goal,
    workspace_id: workspaceId || undefined,
  })
}

export function formatHashtags(tags: string[]) {
  return tags
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag.replace(/^#+/, '')}`))
    .join(' ')
}

export function captionWithHashtags(caption: string, hashtags: string[]) {
  const tags = formatHashtags(hashtags)
  if (!tags) {
    return caption.trim()
  }
  return `${caption.trim()}\n\n${tags}`
}
