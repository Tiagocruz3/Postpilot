import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { resolveRequestUserId } from '../_shared/api-auth.ts'
import { recordPublishResult, updatePostMetrics } from '../_shared/post-results.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type LinkedInMeta = {
  linkedin_id?: string
  selected_profile_id?: string
  profiles?: Array<{ id?: string; author_urn?: string; type?: string; name?: string }>
}

function resolveAuthor(meta: LinkedInMeta) {
  const selected = meta.selected_profile_id || meta.linkedin_id
  const entry = Array.isArray(meta.profiles)
    ? meta.profiles.find((profile) => profile?.id && profile.id === selected)
    : undefined
  return entry?.author_urn || (meta.linkedin_id ? `urn:li:person:${meta.linkedin_id}` : null)
}

function shareIdFromUrn(urn: string): string | null {
  const match = urn.match(/(urn:li:(?:share|ugcPost):[A-Za-z0-9]+)/)
  return match ? match[1] : null
}

function linkedinPermalink(urn: string): string {
  const id = urn.split(':').pop()
  return id ? `https://www.linkedin.com/feed/update/${id}` : `https://www.linkedin.com/feed/update/${urn}`
}

async function fetchLinkedInMetrics(urn: string, token: string) {
  const encoded = encodeURIComponent(urn)
  const url = `https://api.linkedin.com/v2/socialActions/${encoded}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'X-Restli-Protocol-Version': '2.0.0' },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      metrics: null,
      error: (data as { message?: string }).message || `LinkedIn metrics returned ${res.status}.`,
    }
  }

  return {
    metrics: {
      likes: data.likesSummary?.totalLikes ?? data.likesSummary?.aggregatedTotalLikes ?? 0,
      comments: data.commentsSummary?.totalFirstLevelComments ?? data.commentsSummary?.aggregatedTotalComments ?? 0,
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

    const urn = (scheduled as { platform_post_id?: string | null } | null)?.platform_post_id
    if (!scheduled || !urn) {
      return new Response(JSON.stringify({ error: 'No LinkedIn URN stored for this post yet.' }), {
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
      .select('access_token_encrypted')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'linkedin')
      .maybeSingle()
    const token = (integration as { access_token_encrypted?: string } | null)?.access_token_encrypted
    if (!token) {
      return new Response(JSON.stringify({ error: 'Reconnect LinkedIn in Settings to refresh metrics.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const result = await fetchLinkedInMetrics(urn, token)
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
    return new Response(JSON.stringify({ error: 'task_id is required.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
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
    .eq('provider', 'linkedin')
    .single()
  if (!integration) {
    await recordPublishResult(supabase, { task_id: taskId, status: 'failed', error_message: 'No LinkedIn integration.' })
    return new Response(JSON.stringify({ error: 'No LinkedIn integration.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const meta = ((integration as { metadata?: LinkedInMeta }).metadata ?? {}) as LinkedInMeta
  const author = resolveAuthor(meta)
  const token = (integration as { access_token_encrypted: string }).access_token_encrypted

  if (!author) {
    await recordPublishResult(supabase, {
      task_id: taskId,
      status: 'failed',
      error_message: 'LinkedIn profile missing. Reconnect LinkedIn in Settings.',
    })
    return new Response(JSON.stringify({ error: 'LinkedIn profile missing. Reconnect LinkedIn in Settings.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const payload: Record<string, unknown> = {
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: content },
          shareMediaCategory: mediaUrls.length ? 'IMAGE' : 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }

    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.id) {
      throw new Error(data?.message || `LinkedIn returned ${res.status}.`)
    }

    const urn = shareIdFromUrn(data.id) || data.id
    const permalink = linkedinPermalink(urn)
    const previewImage = mediaUrls[0] || null

    const scheduled = await recordPublishResult(supabase, {
      task_id: taskId,
      status: 'published',
      platform_post_id: urn,
      published_url: permalink,
      permalink_url: permalink,
      preview_image_url: previewImage,
    })

    if (scheduled?.id) {
      const metrics = await fetchLinkedInMetrics(urn, token)
      await updatePostMetrics(supabase, scheduled.id, metrics.metrics ?? {}, metrics.error)
    }

    return new Response(
      JSON.stringify({
        success: true,
        post_id: urn,
        permalink_url: permalink,
        preview_image_url: previewImage,
        scheduled_post_id: scheduled?.id ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'LinkedIn publish failed.'
    await recordPublishResult(supabase, { task_id: taskId, status: 'failed', error_message: message })
    return new Response(JSON.stringify({ error: message }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
