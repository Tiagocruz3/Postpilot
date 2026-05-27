export type ContentAiProvider = 'openrouter' | 'lmstudio'

export interface OpenRouterModelOption {
  id: string
  name: string
  description?: string
  output_modalities?: string[]
  context_length?: number
}

export interface LmStudioModelOption {
  id: string
  object?: string
}

export interface AiSettings {
  contentProvider: ContentAiProvider
  openRouterContentModel: string
  openRouterImageModel: string
  falVideoModel: string
  lmStudioBaseUrl: string
  lmStudioContentModel: string
}

export const AI_SETTINGS_STORAGE_KEY = 'postpilot.ai-settings'

export const DEFAULT_AI_SETTINGS: AiSettings = {
  contentProvider: 'openrouter',
  openRouterContentModel: '',
  openRouterImageModel: 'google/gemini-2.5-flash-image-preview',
  falVideoModel: 'fal-ai/kling-video/v2.1/master/text-to-video',
  lmStudioBaseUrl: 'http://127.0.0.1:1234/v1',
  lmStudioContentModel: '',
}

export const DEFAULT_FAL_VIDEO_MODELS = [
  {
    id: 'fal-ai/kling-video/v2.1/master/text-to-video',
    label: 'Kling 2.1 Text to Video',
    description: 'General-purpose text-to-video generation.',
  },
  {
    id: 'fal-ai/minimax-video-01-live/text-to-video',
    label: 'MiniMax Video 01 Live',
    description: 'Fast text-to-video generation for short clips.',
  },
  {
    id: 'fal-ai/veo2',
    label: 'Veo 2',
    description: 'High-end cinematic video generation.',
  },
  {
    id: 'fal-ai/seedance/v1/pro/text-to-video',
    label: 'Seedance Pro',
    description: 'Premium video generation with stronger motion handling.',
  },
]

export function loadAiSettings() {
  const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY)
  if (!raw) {
    return DEFAULT_AI_SETTINGS
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AiSettings> & {
      openRouterApiKey?: string
      falApiKey?: string
    }
    const { openRouterApiKey: _openRouterApiKey, falApiKey: _falApiKey, ...rest } = parsed
    return {
      ...DEFAULT_AI_SETTINGS,
      ...rest,
    }
  } catch {
    return DEFAULT_AI_SETTINGS
  }
}

export function saveAiSettings(settings: AiSettings) {
  localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}
