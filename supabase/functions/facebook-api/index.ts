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
    .eq('provider', 'facebook')
    .single()

  if (!integration) return new Response('No Facebook integration', { status: 400 })

  const meta = (integration.metadata ?? {}) as {
    page_id?: string
    selected_page_id?: string
    pages?: Array<{ id?: string; name?: string; access_token?: string }>
  }
  const targetPageId = meta.selected_page_id || meta.page_id
  const pageEntry = Array.isArray(meta.pages)
    ? meta.pages.find((p) => p && p.id && p.id === targetPageId)
    : undefined
  const pageId = pageEntry?.id || targetPageId
  const token = pageEntry?.access_token || integration.access_token_encrypted

  if (!pageId || !token) {
    return new Response('Facebook integration is missing a page or access token. Reconnect Facebook in Settings.', {
      status: 400,
    })
  }

  let postId: string | null = null
  if (media_urls && media_urls.length > 0) {
    const form = new FormData()
    form.append('message', content)
    form.append('access_token', token)
    const res = await fetch(`https://graph.facebook.com/v18.0/${pageId}/photos`, {
      method: 'POST',
      body: form,
    })
    const data = await res.json()
    postId = data.post_id || data.id
  } else {
    const res = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: content, access_token: token }),
    })
    const data = await res.json()
    postId = data.id
  }

  await supabase.from('planner_tasks').update({ status: 'published' }).eq('id', task_id)
  await supabase.from('scheduled_posts').update({ published_at: new Date().toISOString(), published_url: `https://facebook.com/${postId}` }).eq('planner_task_id', task_id)

  return new Response(JSON.stringify({ success: true, post_id: postId }), { headers: { 'Content-Type': 'application/json' } })
})
