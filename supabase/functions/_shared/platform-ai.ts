import { getAdminClient } from './oauth.ts'

export type PlatformAiBackend = 'openrouter' | 'lovable' | 'lmstudio'

export type WorkspaceAiSettings = {
  content_provider: 'openrouter' | 'lmstudio'
  openrouter_content_model: string | null
  openrouter_image_model: string | null
  fal_video_model: string | null
  lmstudio_base_url: string
  lmstudio_content_model: string | null
}

export async function getWorkspaceAiSettings(workspaceId?: string | null): Promise<WorkspaceAiSettings | null> {
  if (!workspaceId) return null
  try {
    const { data } = await getAdminClient()
      .from('workspace_ai_settings')
      .select(
        'content_provider, openrouter_content_model, openrouter_image_model, fal_video_model, lmstudio_base_url, lmstudio_content_model',
      )
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    return (data as WorkspaceAiSettings | null) ?? null
  } catch (_error) {
    return null
  }
}

export function getPlatformAiBackend(): PlatformAiBackend {
  if (Deno.env.get('OPENROUTER_API_KEY')?.trim()) {
    return 'openrouter'
  }
  return 'lovable'
}

export function getOpenRouterApiKey(): string | null {
  const key = Deno.env.get('OPENROUTER_API_KEY')?.trim()
  return key || null
}

export function getOpenRouterContentModel(workspaceSettings?: WorkspaceAiSettings | null): string {
  return (
    workspaceSettings?.openrouter_content_model?.trim() ||
    Deno.env.get('OPENROUTER_CONTENT_MODEL')?.trim() ||
    'google/gemini-2.5-pro'
  )
}

export function getOpenRouterResearchModel(): string {
  return Deno.env.get('OPENROUTER_RESEARCH_MODEL')?.trim() || 'perplexity/sonar'
}

export function getOpenRouterImageModel(workspaceSettings?: WorkspaceAiSettings | null): string {
  return (
    workspaceSettings?.openrouter_image_model?.trim() ||
    Deno.env.get('OPENROUTER_IMAGE_MODEL')?.trim() ||
    'google/gemini-2.5-flash-image-preview'
  )
}

export function getLovableApiKey(): string | null {
  const key = Deno.env.get('LOVABLE_API_KEY')?.trim()
  return key || null
}

export function getLovableAiUrl(): string {
  return Deno.env.get('LOVABLE_AI_URL')?.trim() || 'https://ai.lovable.dev/v1'
}

export function getFalApiKey(): string | null {
  const key = Deno.env.get('FAL_API_KEY')?.trim()
  return key || null
}

export function getFalVideoModel(workspaceSettings?: WorkspaceAiSettings | null): string {
  return (
    workspaceSettings?.fal_video_model?.trim() ||
    Deno.env.get('FAL_VIDEO_MODEL')?.trim() ||
    'fal-ai/kling-video/v2.1/master/text-to-video'
  )
}
