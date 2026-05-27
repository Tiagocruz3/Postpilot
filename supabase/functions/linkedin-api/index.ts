import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { resolveRequestUserId } from '../_shared/api-auth.ts'

serve(async (req) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const body = await req.json().catch(() => ({}))
  const { task_id, content, media_urls } = body
  const userId = await resolveRequestUserId(req, supabase, task_id)
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const { data: task } = await supabase.from('planner_tasks').select('*').eq('id', task_id).single()
  const { data: integration } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('workspace_id', task.workspace_id)
    .eq('provider', 'linkedin')
    .single()

  if (!integration) return new Response('No LinkedIn integration', { status: 400 })

  const meta = (integration.metadata ?? {}) as {
    linkedin_id?: string
    selected_profile_id?: string
    profiles?: Array<{ id?: string; author_urn?: string; type?: string; name?: string }>
  }
  const selectedProfileId = meta.selected_profile_id || meta.linkedin_id
  const profileEntry = Array.isArray(meta.profiles)
    ? meta.profiles.find((entry) => entry?.id && entry.id === selectedProfileId)
    : undefined
  const author =
    profileEntry?.author_urn ||
    (meta.linkedin_id ? `urn:li:person:${meta.linkedin_id}` : null)

  if (!author) {
    return new Response('LinkedIn integration is missing profile information. Reconnect LinkedIn in Settings.', {
      status: 400,
    })
  }

  const payload: Record<string, unknown> = {
    author,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: content },
        shareMediaCategory: media_urls?.length ? 'IMAGE' : 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  }

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${integration.access_token_encrypted}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
    body: JSON.stringify(payload),
  })

  const data = await res.json()
  const shareUrl = data.id ? `https://www.linkedin.com/feed/update/${data.id}` : null

  await supabase.from('planner_tasks').update({ status: 'published' }).eq('id', task_id)
  await supabase.from('scheduled_posts').update({ published_at: new Date().toISOString(), published_url: shareUrl }).eq('planner_task_id', task_id)

  return new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } })
})
