import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = JSON.parse(atob(url.searchParams.get('state') || '{}'))
  const workspaceId = state.workspace_id
  const redirectUri = `${url.origin}/facebook-oauth-callback`

  const tokenRes = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${Deno.env.get('META_APP_ID')}&client_secret=${Deno.env.get('META_APP_SECRET')}&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`
  const tokenData = await (await fetch(tokenUrl)).json()

  const pagesRes = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${tokenData.access_token}`)
  const pagesData = await pagesRes.json()
  const page = pagesData.data?.[0]

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: { user } } = await supabase.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', '') || '')
  if (!user) return new Response('Unauthorized', { status: 401 })

  await supabase.from('user_integrations').upsert({
    user_id: user.id,
    workspace_id: workspaceId,
    provider: 'facebook',
    access_token_encrypted: tokenData.access_token,
    token_iv: '',
    refresh_token_encrypted: tokenData.access_token,
    expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
    metadata: { page_id: page?.id, page_name: page?.name },
  }, { onConflict: 'user_id,workspace_id,provider' })

  return new Response(null, { status: 302, headers: { Location: `${Deno.env.get('APP_URL') || url.origin}/settings` } })
})
