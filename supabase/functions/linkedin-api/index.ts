import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

serve(async (req) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: { user } } = await supabase.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', '') || '')
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { task_id, content, media_urls } = body

  const { data: task } = await supabase.from('planner_tasks').select('*').eq('id', task_id).single()
  const { data: integration } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('user_id', user.id)
    .eq('workspace_id', task.workspace_id)
    .eq('provider', 'linkedin')
    .single()

  if (!integration) return new Response('No LinkedIn integration', { status: 400 })

  const token = integration.access_token_encrypted
  const personUrn = integration.metadata?.linkedin_id

  const payload: any = {
    author: `urn:li:person:${personUrn}`,
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
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
    body: JSON.stringify(payload),
  })

  const data = await res.json()
  const shareUrl = data.id ? `https://www.linkedin.com/feed/update/${data.id}` : null

  await supabase.from('planner_tasks').update({ status: 'published' }).eq('id', task_id)
  await supabase.from('scheduled_posts').update({ published_at: new Date().toISOString(), published_url: shareUrl }).eq('planner_task_id', task_id)

  return new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } })
})
