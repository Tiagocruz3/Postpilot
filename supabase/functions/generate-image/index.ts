import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { buildImagePrompt, type ComposePlatform } from '../_shared/compose-ai.ts'
import { getAdminClient } from '../_shared/oauth.ts'
import { persistAiMedia, type AiMediaSource } from '../_shared/library-media.ts'
import {
  getLovableAiUrl,
  getLovableApiKey,
  getOpenRouterApiKey,
  getOpenRouterImageModel,
  getWorkspaceAiSettings,
  getPlatformAiBackend,
} from '../_shared/platform-ai.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function isPlatform(value: unknown): value is ComposePlatform {
  return value === 'facebook' || value === 'linkedin' || value === 'x'
}

function asDataUrl(contentType: string, base64: string): string {
  return `data:${contentType};base64,${base64}`
}

const KNOWN_GOOD_IMAGE_MODEL = 'google/gemini-2.5-flash-image-preview'

async function callOpenRouterImage(apiKey: string, model: string, prompt: string): Promise<{ res: Response; data: Record<string, unknown> }> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': Deno.env.get('APP_URL') || 'https://adguru.app',
      'X-Title': 'Ad Guru',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text'],
    }),
  })
  const data = await res.json().catch(() => ({}))
  return { res, data: data as Record<string, unknown> }
}

function extractImageUrl(aiData: Record<string, unknown>): string {
  const choice = (
    aiData.choices as Array<{
      message?: {
        content?: unknown
        images?: Array<{ image_url?: { url?: string; b64_json?: string } | string; b64_json?: string }>
      }
    }> | undefined
  )?.[0]
  const images = choice?.message?.images
  if (Array.isArray(images)) {
    for (const image of images) {
      const imageUrl = image.image_url
      const url =
        typeof imageUrl === 'string'
          ? imageUrl
          : imageUrl && typeof imageUrl === 'object'
            ? (imageUrl as { url?: string }).url
            : undefined
      if (url) {
        return url
      }
      const b64 =
        (typeof imageUrl === 'object' && imageUrl !== null
          ? (imageUrl as { b64_json?: string }).b64_json
          : undefined) || image.b64_json
      if (b64) {
        return asDataUrl('image/png', b64)
      }
    }
  }

  const content = choice?.message?.content

  if (typeof content === 'string') {
    if (content.startsWith('http') || content.startsWith('data:')) {
      return content
    }
    const match = content.match(/https?:\/\/\S+/)
    return match?.[0] ?? ''
  }

  if (Array.isArray(content)) {
    for (const part of content) {
      if (typeof part === 'object' && part !== null) {
        const record = part as Record<string, unknown>
        if (record.type === 'image_url' && typeof record.image_url === 'object' && record.image_url !== null) {
          const url = (record.image_url as { url?: string }).url
          if (url) {
            return url
          }
        }
        if (record.type === 'image_base64' && typeof record.image_base64 === 'string') {
          return asDataUrl('image/png', record.image_base64)
        }
        if (typeof record.b64_json === 'string') {
          return asDataUrl('image/png', record.b64_json)
        }
      }
    }
  }

  const data = aiData.data as Array<{ url?: string; b64_json?: string }> | undefined
  const dataUrl = data?.[0]?.url
  if (dataUrl) {
    return dataUrl
  }
  if (data?.[0]?.b64_json) {
    return asDataUrl('image/png', data[0].b64_json)
  }

  const output = aiData.output as Array<{ url?: string; image?: { url?: string } }> | undefined
  if (output?.[0]?.url) {
    return output[0].url
  }
  if (output?.[0]?.image?.url) {
    return output[0].image.url
  }

  return ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const platform = isPlatform(body.platform) ? body.platform : 'facebook'
    const userHint = typeof body.hint === 'string' ? body.hint : ''
    const postText = typeof body.post_text === 'string' ? body.post_text : ''
    const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : ''
    const userId = typeof body.user_id === 'string' ? body.user_id : ''
    const source: AiMediaSource = body.source === 'ads' ? 'ads' : 'compose'
    const metadata =
      typeof body.metadata === 'object' && body.metadata !== null
        ? (body.metadata as Record<string, unknown>)
        : {}
    const prompt =
      typeof body.prompt === 'string' && body.prompt.trim()
        ? body.prompt.trim()
        : buildImagePrompt(platform, postText || 'social media post', userHint)
    const workspaceSettings = await getWorkspaceAiSettings(workspaceId)

    const backend = getPlatformAiBackend()
    let aiRes: Response
    let aiData: Record<string, unknown>
    let modelUsed = ''
    let fallbackNotice: string | null = null

    if (backend === 'openrouter') {
      const apiKey = getOpenRouterApiKey()!
      const requestedModel = getOpenRouterImageModel(workspaceSettings)
      modelUsed = requestedModel
      const first = await callOpenRouterImage(apiKey, requestedModel, prompt)
      aiRes = first.res
      aiData = first.data

      if (aiRes.ok && !extractImageUrl(aiData) && requestedModel !== KNOWN_GOOD_IMAGE_MODEL) {
        const retry = await callOpenRouterImage(apiKey, KNOWN_GOOD_IMAGE_MODEL, prompt)
        if (retry.res.ok && extractImageUrl(retry.data)) {
          aiRes = retry.res
          aiData = retry.data
          modelUsed = KNOWN_GOOD_IMAGE_MODEL
          fallbackNotice = `"${requestedModel}" returned no image, used "${KNOWN_GOOD_IMAGE_MODEL}" instead. Update Settings → Image AI to make this the default.`
        }
      }
    } else {
      const lovableKey = getLovableApiKey()
      if (!lovableKey) {
        return new Response(JSON.stringify({ error: 'AI is not configured. Set OPENROUTER_API_KEY or LOVABLE_API_KEY.' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      modelUsed = 'google/gemini-2.5-flash-image (lovable)'

      aiRes = await fetch(`${getLovableAiUrl()}/images/generations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-image',
          prompt,
          n: 1,
          size: '1024x1024',
        }),
      })
      aiData = (await aiRes.json().catch(() => ({}))) as Record<string, unknown>
    }

    if (!aiRes.ok) {
      const message = (aiData as { error?: { message?: string } }).error?.message || 'Image generation failed.'
      return new Response(JSON.stringify({ error: message }), {
        status: aiRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const sourceUrl = extractImageUrl(aiData)
    if (!sourceUrl) {
      const choice = (
        aiData as { choices?: Array<{ message?: { content?: unknown }; finish_reason?: string }> }
      ).choices?.[0]
      const refusal =
        typeof choice?.message?.content === 'string' && choice.message.content.trim()
          ? choice.message.content.trim()
          : null
      const finishReason = choice?.finish_reason || null
      const hint = refusal
        ? `Model "${modelUsed}" replied without an image (${finishReason ?? 'no finish reason'}): ${refusal.slice(0, 240)}`
        : `Model "${modelUsed}" returned no image. It may not support image generation on OpenRouter — pick a different image model in Settings (e.g. ${KNOWN_GOOD_IMAGE_MODEL}).`
      return new Response(
        JSON.stringify({
          error: hint,
          model: modelUsed,
          finish_reason: finishReason,
          raw_preview: JSON.stringify(aiData).slice(0, 1200),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    let url = sourceUrl
    let libraryId: string | null = null

    if (workspaceId && userId) {
      const supabase = getAdminClient()
      const saved = await persistAiMedia(supabase, {
        workspaceId,
        userId,
        mediaType: 'image',
        sourceUrl,
        prompt,
        source,
        metadata: { platform, ...metadata },
      })
      url = saved.url
      libraryId = saved.id
    }

    return new Response(JSON.stringify({ url, library_id: libraryId, model: modelUsed, fallback_notice: fallbackNotice }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to generate image.'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
