import {
  getLovableAiUrl,
  getLovableApiKey,
  getOpenRouterApiKey,
  getOpenRouterContentModel,
  getOpenRouterResearchModel,
  getWorkspaceAiSettings,
  getPlatformAiBackend,
} from './platform-ai.ts'

export type AiMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export async function completeChat(options: {
  messages: AiMessage[]
  temperature?: number
  jsonMode?: boolean
  webSearch?: boolean
  workspaceId?: string
}): Promise<string> {
  const workspaceSettings = await getWorkspaceAiSettings(options.workspaceId)
  const backendPreference = workspaceSettings?.content_provider === 'lmstudio' ? 'lmstudio' : getPlatformAiBackend()
  const temperature = options.temperature ?? 0.7

  if (backendPreference === 'lmstudio') {
    try {
      const baseUrl = (workspaceSettings?.lmstudio_base_url || 'http://127.0.0.1:1234/v1').replace(/\/$/, '')
      const model = workspaceSettings?.lmstudio_content_model?.trim()
      if (!model) {
        throw new Error('LM Studio is selected, but no local model is configured in Settings.')
      }
      if (options.webSearch) {
        throw new Error('Live web research is not supported with LM Studio. Switch Content AI to OpenRouter.')
      }

      const lmRes = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: options.messages,
          temperature,
          ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      })
      const lmData = await lmRes.json()
      if (!lmRes.ok) {
        const message =
          (lmData as { error?: { message?: string } }).error?.message ||
          (lmData as { message?: string }).message ||
          'LM Studio request failed.'
        throw new Error(message)
      }
      const raw = (lmData as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content
      if (!raw?.trim()) {
        throw new Error('No response from the local model.')
      }
      return raw.trim()
    } catch (lmError) {
      if (!getOpenRouterApiKey()) {
        throw lmError
      }
    }
  }

  if (getOpenRouterApiKey()) {
    const apiKey = getOpenRouterApiKey()
    if (!apiKey) {
      throw new Error('OpenRouter is not configured.')
    }

    const model = options.webSearch ? getOpenRouterResearchModel() : getOpenRouterContentModel(workspaceSettings)
    const body: Record<string, unknown> = {
      model,
      messages: options.messages,
      temperature,
    }

    if (options.jsonMode) {
      body.response_format = { type: 'json_object' }
    }

    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('APP_URL') || 'https://adguru.app',
        'X-Title': 'Ad Guru',
      },
      body: JSON.stringify(body),
    })

    const aiData = await aiRes.json()
    if (!aiRes.ok) {
      const message = (aiData as { error?: { message?: string } }).error?.message || 'AI request failed.'
      throw new Error(message)
    }

    const raw = (aiData as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content
    if (!raw?.trim()) {
      throw new Error('No response from the model.')
    }
    return raw.trim()
  }

  if (options.webSearch) {
    throw new Error('Live web research requires OPENROUTER_API_KEY (uses a search-capable model).')
  }

  const lovableKey = getLovableApiKey()
  if (!lovableKey) {
    throw new Error('AI is not configured. Set OPENROUTER_API_KEY or LOVABLE_API_KEY.')
  }

  const aiRes = await fetch(`${getLovableAiUrl()}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: options.messages,
      temperature,
      ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  })

  const aiData = await aiRes.json()
  if (!aiRes.ok) {
    const message = (aiData as { error?: { message?: string } }).error?.message || 'AI request failed.'
    throw new Error(message)
  }

  const raw = (aiData as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content
  if (!raw?.trim()) {
    throw new Error('No response from the model.')
  }
  return raw.trim()
}

export function parseJsonFromModel<T>(raw: string): T {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed) as T
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) {
      throw new Error('Model did not return valid JSON.')
    }
    return JSON.parse(match[0]) as T
  }
}
