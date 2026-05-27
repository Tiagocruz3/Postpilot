import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { resolveRequestUserId } from '../_shared/api-auth.ts'
import { recordPublishResult, updatePostMetrics } from '../_shared/post-results.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type InstagramMeta = {
  selected_instagram_account_id?: string | null
  instagram_accounts?: Array<{
    id?: string
    username?: string
    name?: string
    page_id?: string
    access_token?: string
  }>
}

function pickInstagramAccount(meta: InstagramMeta) {
  const accounts = Array.isArray(meta.instagram_accounts) ? meta.instagram_accounts : []
  const targetId = meta.selected_instagram_account_id || accounts[0]?.id
  return accounts.find((entry) => entry?.id && entry.id === targetId) || accounts[0] || null
}

async function fetchInstagramDetails(mediaId: string, token: string) {
  const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(mediaId)}?fields=permalink,thumbnail_url,media_url,caption&access_token=${encodeURIComponent(token)}`
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  return res.ok
    ? (data as { permalink?: string; thumbnail_url?: string; media_url?: string; caption?: string })
    : null
}

async function fetchInstagramMetrics(mediaId: string, token: string) {
  const metric = 'impressions,reach,engagement,likes,comments,saved,video_views'
  const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(mediaId)}/insights?metric=${encodeURIComponent(metric)}&access_token=${encodeURIComponent(token)}`
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { metrics: null, error: (data as { error?: { message?: string } }).error?.message || `Instagram insights returned ${res.status}.` }
  }
  const entries = Array.isArray(data.data) ? data.data : []
  const result: Record<string, number> = {}
  for (const entry of entries) {
    if (entry?.name && Array.isArray(entry.values)) {
      const value = entry.values[0]?.value
      if (typeof value === 'number') {
        result[entry.name] = value
      }
    }
  }
  return { metrics: result, error: null as string | null }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const body = await req.json().catch(() => ({}))
  const action: string = body.action || 'publish'

  if (action === 'metrics') {
    const userId = await resolveRequestUserId(req, supabase)
    if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const scheduledPostId = body.scheduled_post_id as string | undefined
    if (!scheduledPostId) {
      return new Response(JSON.stringify({ error: 'scheduled_post_id is required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: scheduled } = await supabase
      .from('scheduled_posts')
      .select('id, platform_post_id, planner_task_id')
      .eq('id', scheduledPostId)
      .maybeSingle()
    const mediaId = (scheduled as { platform_post_id?: string | null } | null)?.platform_post_id
    if (!scheduled || !mediaId) {
      return new Response(JSON.stringify({ error: 'No Instagram media id stored for this post yet.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: task } = await supabase
      .from('planner_tasks')
      .select('workspace_id')
      .eq('id', (scheduled as { planner_task_id: string }).planner_task_id)
      .maybeSingle()
    const workspaceId = (task as { workspace_id?: string } | null)?.workspace_id
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'Could not resolve workspace for this post.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: integration } = await supabase
      .from('user_integrations')
      .select('metadata, access_token_encrypted')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'facebook')
      .maybeSingle()
    if (!integration) {
      return new Response(JSON.stringify({ error: 'Reconnect Facebook in Settings to refresh metrics.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const account = pickInstagramAccount((integration.metadata ?? {}) as InstagramMeta)
    const token = account?.access_token || (integration as { access_token_encrypted?: string }).access_token_encrypted
    if (!token) {
      return new Response(JSON.stringify({ error: 'Instagram access token missing. Reconnect Facebook in Settings.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const result = await fetchInstagramMetrics(mediaId, token)
    await updatePostMetrics(supabase, scheduledPostId, result.metrics ?? {}, result.error)
    return new Response(JSON.stringify({ success: true, metrics: result.metrics, error: result.error }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const taskId = body.task_id as string | undefined
  const content = (body.content as string | undefined) ?? ''
  const mediaUrls = (body.media_urls as string[] | undefined) ?? []

  const userId = await resolveRequestUserId(req, supabase, taskId)
  if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  if (!taskId) {
    return new Response(JSON.stringify({ error: 'task_id is required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const { data: task } = await supabase.from('planner_tasks').select('*').eq('id', taskId).single()
  if (!task) {
    return new Response(JSON.stringify({ error: 'Planner task not found.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const { data: integration } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('workspace_id', (task as { workspace_id: string }).workspace_id)
    .eq('provider', 'facebook')
    .single()
  if (!integration) {
    await recordPublishResult(supabase, {
      task_id: taskId,
      status: 'failed',
      error_message: 'Connect Facebook in Settings to publish to Instagram.',
    })
    return new Response(JSON.stringify({ error: 'Connect Facebook in Settings to publish to Instagram.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const meta = ((integration as { metadata?: InstagramMeta }).metadata ?? {}) as InstagramMeta
  const account = pickInstagramAccount(meta)
  if (!account?.id) {
    await recordPublishResult(supabase, {
      task_id: taskId,
      status: 'failed',
      error_message: 'No Instagram Business account found. Link Instagram to your Facebook Page.',
    })
    return new Response(JSON.stringify({ error: 'No Instagram Business account found. Link Instagram to your Facebook Page.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const token = account.access_token || (integration as { access_token_encrypted?: string }).access_token_encrypted
  if (!token) {
    await recordPublishResult(supabase, {
      task_id: taskId,
      status: 'failed',
      error_message: 'Instagram access token missing. Reconnect Facebook in Settings.',
    })
    return new Response(JSON.stringify({ error: 'Instagram access token missing. Reconnect Facebook in Settings.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!mediaUrls.length) {
    await recordPublishResult(supabase, {
      task_id: taskId,
      status: 'failed',
      error_message: 'Instagram posts require at least one image or video.',
    })
    return new Response(JSON.stringify({ error: 'Instagram posts require at least one image or video.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const imageUrl = mediaUrls[0]
    const createRes = await fetch(`https://graph.facebook.com/v18.0/${account.id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, caption: content, access_token: token }),
    })
    const createData = await createRes.json().catch(() => ({}))
    if (!createRes.ok || !createData.id) {
      throw new Error(createData?.error?.message || 'Could not create Instagram media container.')
    }

    const publishRes = await fetch(`https://graph.facebook.com/v18.0/${account.id}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: createData.id, access_token: token }),
    })
    const publishData = await publishRes.json().catch(() => ({}))
    if (!publishRes.ok || !publishData.id) {
      throw new Error(publishData?.error?.message || 'Could not publish to Instagram.')
    }

    const mediaId = publishData.id as string
    const details = await fetchInstagramDetails(mediaId, token)
    const permalink = details?.permalink || (account.username ? `https://www.instagram.com/${account.username}/` : null)
    const previewImage = details?.thumbnail_url || details?.media_url || imageUrl

    const scheduled = await recordPublishResult(supabase, {
      task_id: taskId,
      status: 'published',
      platform_post_id: mediaId,
      published_url: permalink,
      permalink_url: permalink,
      preview_image_url: previewImage,
    })

    if (scheduled?.id) {
      const metrics = await fetchInstagramMetrics(mediaId, token)
      await updatePostMetrics(supabase, scheduled.id, metrics.metrics ?? {}, metrics.error)
    }

    return new Response(
      JSON.stringify({
        success: true,
        post_id: mediaId,
        permalink_url: permalink,
        preview_image_url: previewImage,
        scheduled_post_id: scheduled?.id ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Instagram publish failed.'
    await recordPublishResult(supabase, { task_id: taskId, status: 'failed', error_message: message })
    return new Response(JSON.stringify({ error: message }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
