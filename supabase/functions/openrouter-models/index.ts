import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { getOpenRouterApiKey } from '../_shared/platform-ai.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const apiKey = getOpenRouterApiKey()
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OpenRouter is not configured by the platform owner.' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json().catch(() => ({}))
  const mode = body.mode === 'image' ? 'image' : 'text'
  const url =
    mode === 'image'
      ? 'https://openrouter.ai/api/v1/models?output_modalities=image'
      : 'https://openrouter.ai/api/v1/models?output_modalities=text'

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  const payload = await response.json()
  if (!response.ok) {
    const message =
      (payload as { error?: { message?: string } }).error?.message ||
      (payload as { message?: string }).message ||
      `OpenRouter returned ${response.status}`
    return new Response(JSON.stringify({ error: message }), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
