import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { resolveRequestUserId } from '../_shared/api-auth.ts'
import { recordPublishResult, updatePostMetrics } from '../_shared/post-results.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type FacebookMeta = {
  page_id?: string
  selected_page_id?: string
  pages?: Array<{ id?: string; name?: string; access_token?: string }>
}

function pickPage(meta: FacebookMeta) {
  const targetPageId = meta.selected_page_id || meta.page_id
  const entry = Array.isArray(meta.pages)
    ? meta.pages.find((p) => p && p.id && p.id === targetPageId)
    : undefined
  return {
    pageId: entry?.id || targetPageId || null,
    name: entry?.name || null,
    accessToken: entry?.access_token || null,
  }
}

async function fetchPostDetails(postId: string, token: string) {
  const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(postId)}?fields=permalink_url,full_picture,message&access_token=${encodeURIComponent(token)}`
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  return res.ok ? (data as { permalink_url?: string; full_picture?: string; message?: string }) : null
}

async function fetchPostMetrics(postId: string, token: string) {
  const fields = [
    'reactions.summary(total_count).limit(0)',
    'comments.summary(total_count).limit(0)',
    'shares',
    'insights.metric(post_impressions,post_impressions_unique,post_video_views)',
  ].join(',')

  const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(postId)}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = (data as { error?: { message?: string } }).error?.message
    return { metrics: null, error: message || `Facebook metrics returned ${res.status}` }
  }

  const reactions = data.reactions?.summary?.total_count ?? 0
  const comments = data.comments?.summary?.total_count ?? 0
  const shares = data.shares?.count ?? 0
  const insights = Array.isArray(data.insights?.data) ? data.insights.data : []
  const insightMap: Record<string, number> = {}
  for (const entry of insights) {
    if (entry && typeof entry.name === 'string' && Array.isArray(entry.values)) {
      const value = entry.values[0]?.value
      if (typeof value === 'number') {
        insightMap[entry.name] = value
      }
    }
  }

  return {
    metrics: {
      reactions,
      comments,
      shares,
      impressions: insightMap.post_impressions ?? null,
      unique_impressions: insightMap.post_impressions_unique ?? null,
      video_views: insightMap.post_video_views ?? null,
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
      return new Response(JSON.stringify({ error: 'scheduled_post_id is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: scheduled } = await supabase
      .from('scheduled_posts')
      .select('id, platform_post_id, planner_task_id')
      .eq('id', scheduledPostId)
      .maybeSingle()

    const platformPostId = (scheduled as { platform_post_id?: string | null } | null)?.platform_post_id
    if (!scheduled || !platformPostId) {
      return new Response(JSON.stringify({ error: 'This post does not have a Facebook post id stored yet.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: task } = await supabase
      .from('planner_tasks')
      .select('workspace_id')
      .eq('id', (scheduled as { planner_task_id: string }).planner_task_id)
      .maybeSingle()

    const workspaceId = (task as { workspace_id?: string } | null)?.workspace_id
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'Could not resolve workspace for this post.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: integration } = await supabase
      .from('user_integrations')
      .select('access_token_encrypted, metadata')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'facebook')
      .maybeSingle()

    if (!integration) {
      return new Response(JSON.stringify({ error: 'Reconnect Facebook in Settings to load metrics.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const meta = (integration.metadata ?? {}) as FacebookMeta
    const { accessToken } = pickPage(meta)
    const token = accessToken || (integration as { access_token_encrypted?: string }).access_token_encrypted || null
    if (!token) {
      return new Response(JSON.stringify({ error: 'Facebook access token missing. Reconnect Facebook in Settings.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const result = await fetchPostMetrics(platformPostId, token)
    await updatePostMetrics(supabase, scheduledPostId, result.metrics ?? {}, result.error)

    return new Response(
      JSON.stringify({
        success: true,
        metrics: result.metrics,
        error: result.error,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const taskId = body.task_id as string | undefined
  const content = (body.content as string | undefined) ?? ''
  const mediaUrls = (body.media_urls as string[] | undefined) ?? []

  const userId = await resolveRequestUserId(req, supabase, taskId)
  if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  if (!taskId) {
    return new Response(JSON.stringify({ error: 'task_id is required.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: task } = await supabase.from('planner_tasks').select('*').eq('id', taskId).single()
  if (!task) {
    return new Response(JSON.stringify({ error: 'Planner task not found.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: integration } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('workspace_id', (task as { workspace_id: string }).workspace_id)
    .eq('provider', 'facebook')
    .single()

  if (!integration) {
    await recordPublishResult(supabase, { task_id: taskId, status: 'failed', error_message: 'No Facebook integration.' })
    return new Response(JSON.stringify({ error: 'No Facebook integration.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const meta = ((integration as { metadata?: FacebookMeta }).metadata ?? {}) as FacebookMeta
  const { pageId, accessToken } = pickPage(meta)
  const token = accessToken || (integration as { access_token_encrypted?: string }).access_token_encrypted

  if (!pageId || !token) {
    await recordPublishResult(supabase, {
      task_id: taskId,
      status: 'failed',
      error_message: 'Facebook integration is missing a Page or token. Reconnect Facebook in Settings.',
    })
    return new Response(
      JSON.stringify({ error: 'Facebook integration is missing a Page or token. Reconnect Facebook in Settings.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  try {
    let postId: string | null = null
    if (mediaUrls.length > 0) {
      const form = new FormData()
      form.append('message', content)
      form.append('url', mediaUrls[0])
      form.append('access_token', token)
      const res = await fetch(`https://graph.facebook.com/v18.0/${pageId}/photos`, { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error?.message || `Facebook photo upload failed (${res.status}).`)
      }
      postId = data.post_id || data.id || null
    } else {
      const res = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, access_token: token }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error?.message || `Facebook post failed (${res.status}).`)
      }
      postId = data.id || null
    }

    if (!postId) {
      throw new Error('Facebook returned no post id.')
    }

    const details = await fetchPostDetails(postId, token)
    const permalink = details?.permalink_url || `https://www.facebook.com/${postId}`
    const fullPicture = details?.full_picture || mediaUrls[0] || null

    const scheduled = await recordPublishResult(supabase, {
      task_id: taskId,
      status: 'published',
      platform_post_id: postId,
      published_url: permalink,
      permalink_url: permalink,
      preview_image_url: fullPicture,
    })

    if (scheduled?.id) {
      const metrics = await fetchPostMetrics(postId, token)
      await updatePostMetrics(supabase, scheduled.id, metrics.metrics ?? {}, metrics.error)
    }

    return new Response(
      JSON.stringify({
        success: true,
        post_id: postId,
        permalink_url: permalink,
        preview_image_url: fullPicture,
        scheduled_post_id: scheduled?.id ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Facebook publish failed.'
    await recordPublishResult(supabase, { task_id: taskId, status: 'failed', error_message: message })
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
