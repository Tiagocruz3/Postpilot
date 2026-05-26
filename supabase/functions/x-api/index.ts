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
    .eq('provider', 'x')
    .single()

  if (!integration) return new Response('No X integration', { status: 400 })

  const token = integration.access_token_encrypted

  const tweetRes = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: content }),
  })

  const tweetData = await tweetRes.json()
  const tweetUrl = tweetData.data?.id ? `https://x.com/i/web/status/${tweetData.data.id}` : null

  await supabase.from('planner_tasks').update({ status: 'published' }).eq('id', task_id)
  await supabase.from('scheduled_posts').update({ published_at: new Date().toISOString(), published_url: tweetUrl }).eq('planner_task_id', task_id)

  return new Response(JSON.stringify({ success: true, data: tweetData }), { headers: { 'Content-Type': 'application/json' } })
})
