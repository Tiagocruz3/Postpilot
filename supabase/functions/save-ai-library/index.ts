import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { resolveRequestUserId } from '../_shared/api-auth.ts'
import { persistAiMedia, type AiMediaSource, type AiMediaType } from '../_shared/library-media.ts'
import { getAdminClient } from '../_shared/oauth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = getAdminClient()
  const userId = await resolveRequestUserId(req, supabase)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json().catch(() => ({}))
  const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : ''
  const sourceUrl = typeof body.source_url === 'string' ? body.source_url.trim() : ''
  const mediaType: AiMediaType = body.media_type === 'video' ? 'video' : 'image'
  const prompt = typeof body.prompt === 'string' ? body.prompt : ''
  const source: AiMediaSource = body.source === 'ads' ? 'ads' : body.source === 'other' ? 'other' : 'compose'
  const metadata =
    typeof body.metadata === 'object' && body.metadata !== null
      ? (body.metadata as Record<string, unknown>)
      : {}

  if (!workspaceId) {
    return new Response(JSON.stringify({ error: 'workspace_id is required.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!sourceUrl) {
    return new Response(JSON.stringify({ error: 'source_url is required.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { data: existing } = await supabase
      .from('workspace_ai_media')
      .select('id, public_url')
      .eq('workspace_id', workspaceId)
      .eq('public_url', sourceUrl)
      .maybeSingle()

    const existingRow = existing as { id?: string; public_url?: string } | null
    if (existingRow?.id) {
      return new Response(
        JSON.stringify({
          success: true,
          library_id: existingRow.id,
          url: existingRow.public_url || sourceUrl,
          deduped: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const saved = await persistAiMedia(supabase, {
      workspaceId,
      userId,
      mediaType,
      sourceUrl,
      prompt,
      source,
      metadata,
    })

    return new Response(
      JSON.stringify({
        success: true,
        library_id: saved.id,
        url: saved.url,
        deduped: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not save to AI library.'
    console.error('save-ai-library error:', err)
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
