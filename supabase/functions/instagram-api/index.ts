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

  if (!integration) {
    return new Response('No Facebook/Instagram integration. Connect Facebook in Settings.', { status: 400 })
  }

  const meta = (integration.metadata ?? {}) as {
    selected_instagram_account_id?: string | null
    instagram_accounts?: Array<{
      id?: string
      username?: string
      name?: string
      page_id?: string
      access_token?: string
    }>
  }

  const accounts = Array.isArray(meta.instagram_accounts) ? meta.instagram_accounts : []
  const targetId = meta.selected_instagram_account_id || accounts[0]?.id
  const account = accounts.find((entry) => entry?.id && entry.id === targetId) || accounts[0]

  if (!account?.id) {
    return new Response(
      'No Instagram Business account found. Link Instagram to your Facebook Page, then reconnect Facebook.',
      { status: 400 },
    )
  }

  const token = account.access_token || integration.access_token_encrypted
  if (!token) {
    return new Response('Instagram integration is missing an access token. Reconnect Facebook in Settings.', {
      status: 400,
    })
  }

  if (!media_urls?.length) {
    return new Response('Instagram posts require at least one image or video.', { status: 400 })
  }

  const imageUrl = media_urls[0] as string
  const createRes = await fetch(`https://graph.facebook.com/v18.0/${account.id}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl,
      caption: content,
      access_token: token,
    }),
  })
  const createData = await createRes.json()
  if (!createRes.ok || !createData.id) {
    const message = createData.error?.message || 'Could not create Instagram media container.'
    return new Response(message, { status: 400 })
  }

  const publishRes = await fetch(`https://graph.facebook.com/v18.0/${account.id}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: createData.id,
      access_token: token,
    }),
  })
  const publishData = await publishRes.json()
  if (!publishRes.ok) {
    const message = publishData.error?.message || 'Could not publish to Instagram.'
    return new Response(message, { status: 400 })
  }

  const postId = publishData.id as string | undefined
  const publishedUrl = account.username ? `https://www.instagram.com/${account.username}/` : null

  await supabase.from('planner_tasks').update({ status: 'published' }).eq('id', task_id)
  await supabase
    .from('scheduled_posts')
    .update({ published_at: new Date().toISOString(), published_url: publishedUrl })
    .eq('planner_task_id', task_id)

  return new Response(JSON.stringify({ success: true, post_id: postId, published_url: publishedUrl }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
