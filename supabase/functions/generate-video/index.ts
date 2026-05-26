import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { getAdminClient } from '../_shared/oauth.ts'
import { persistAiMedia, type AiMediaSource } from '../_shared/library-media.ts'
import { getFalApiKey, getFalVideoModel, getWorkspaceAiSettings } from '../_shared/platform-ai.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const POLL_INTERVAL_MS = 2000
const MAX_WAIT_MS = 180_000

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function pollFalResult(statusUrl: string, apiKey: string): Promise<string> {
  const started = Date.now()

  while (Date.now() - started < MAX_WAIT_MS) {
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${apiKey}` },
    })
    const statusData = await statusRes.json()

    if (!statusRes.ok) {
      const message =
        (statusData as { detail?: string }).detail ||
        (statusData as { error?: string }).error ||
        'Video generation status check failed.'
      throw new Error(message)
    }

    const status = (statusData as { status?: string }).status
    if (status === 'COMPLETED') {
      const responseUrl = (statusData as { response_url?: string }).response_url
      if (!responseUrl) {
        throw new Error('Video completed but no response URL was returned.')
      }

      const resultRes = await fetch(responseUrl, {
        headers: { Authorization: `Key ${apiKey}` },
      })
      const resultData = await resultRes.json()
      const url =
        (resultData as { video?: { url?: string } }).video?.url ||
        (resultData as { output?: { video?: { url?: string } } }).output?.video?.url ||
        (resultData as { url?: string }).url

      if (!url) {
        throw new Error('Video completed but no video URL was found.')
      }
      return url
    }

    if (status === 'FAILED') {
      const message = (statusData as { error?: string }).error || 'Video generation failed.'
      throw new Error(message)
    }

    await sleep(POLL_INTERVAL_MS)
  }

  throw new Error('Video generation timed out. Try again with a shorter prompt.')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
    const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : ''
    const userId = typeof body.user_id === 'string' ? body.user_id : ''
    const source: AiMediaSource = body.source === 'ads' ? 'ads' : 'compose'
    const platform = typeof body.platform === 'string' ? body.platform : null
    const metadata =
      typeof body.metadata === 'object' && body.metadata !== null
        ? (body.metadata as Record<string, unknown>)
        : {}

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = getFalApiKey()
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Video AI is not configured. Set FAL_API_KEY on the server.' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const workspaceSettings = await getWorkspaceAiSettings(workspaceId)
    const model = getFalVideoModel(workspaceSettings)
    const submitRes = await fetch(`https://queue.fal.run/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    })

    const submitData = await submitRes.json()
    if (!submitRes.ok) {
      const message =
        (submitData as { detail?: string }).detail ||
        (submitData as { error?: string }).error ||
        'Could not start video generation.'
      throw new Error(message)
    }

    const statusUrl = (submitData as { status_url?: string }).status_url
    if (!statusUrl) {
      throw new Error('fal did not return a status URL.')
    }

    const sourceUrl = await pollFalResult(statusUrl, apiKey)

    let url = sourceUrl
    let libraryId: string | null = null

    if (workspaceId && userId) {
      const supabase = getAdminClient()
      const saved = await persistAiMedia(supabase, {
        workspaceId,
        userId,
        mediaType: 'video',
        sourceUrl,
        prompt,
        source,
        metadata: { platform, model, ...metadata },
      })
      url = saved.url
      libraryId = saved.id
    }

    return new Response(JSON.stringify({ url, model, library_id: libraryId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to generate video.'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
