import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { resolveRequestUserId } from '../_shared/api-auth.ts'
import { recordPublishResult, updatePostMetrics } from '../_shared/post-results.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function fetchTweetMetrics(tweetId: string, token: string) {
  const url = `https://api.x.com/2/tweets/${encodeURIComponent(tweetId)}?tweet.fields=public_metrics,non_public_metrics`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { metrics: null, error: (data as { detail?: string }).detail || `X metrics returned ${res.status}.` }
  }
  const publicMetrics = (data as { data?: { public_metrics?: Record<string, number> } }).data?.public_metrics || {}
  return {
    metrics: {
      likes: publicMetrics.like_count ?? 0,
      retweets: publicMetrics.retweet_count ?? 0,
      replies: publicMetrics.reply_count ?? 0,
      quotes: publicMetrics.quote_count ?? 0,
      impressions: publicMetrics.impression_count ?? null,
    },
    error: null as string | null,
  }
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
    const tweetId = (scheduled as { platform_post_id?: string | null } | null)?.platform_post_id
    if (!scheduled || !tweetId) {
      return new Response(JSON.stringify({ error: 'No tweet id stored for this post yet.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
      .select('access_token_encrypted')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'x')
      .maybeSingle()
    const token = (integration as { access_token_encrypted?: string } | null)?.access_token_encrypted
    if (!token) {
      return new Response(JSON.stringify({ error: 'Reconnect X in Settings to refresh metrics.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const result = await fetchTweetMetrics(tweetId, token)
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
    .eq('provider', 'x')
    .single()
  if (!integration) {
    await recordPublishResult(supabase, { task_id: taskId, status: 'failed', error_message: 'No X integration.' })
    return new Response(JSON.stringify({ error: 'No X integration.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const token = (integration as { access_token_encrypted: string }).access_token_encrypted

  try {
    const res = await fetch('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: content }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.data?.id) {
      throw new Error(data?.detail || data?.title || `X returned ${res.status}.`)
    }

    const tweetId = data.data.id as string
    const permalink = `https://x.com/i/web/status/${tweetId}`
    const previewImage = mediaUrls[0] || null

    const scheduled = await recordPublishResult(supabase, {
      task_id: taskId,
      status: 'published',
      platform_post_id: tweetId,
      published_url: permalink,
      permalink_url: permalink,
      preview_image_url: previewImage,
    })

    if (scheduled?.id) {
      const metrics = await fetchTweetMetrics(tweetId, token)
      await updatePostMetrics(supabase, scheduled.id, metrics.metrics ?? {}, metrics.error)
    }

    return new Response(
      JSON.stringify({
        success: true,
        post_id: tweetId,
        permalink_url: permalink,
        preview_image_url: previewImage,
        scheduled_post_id: scheduled?.id ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'X publish failed.'
    await recordPublishResult(supabase, { task_id: taskId, status: 'failed', error_message: message })
    return new Response(JSON.stringify({ error: message }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
