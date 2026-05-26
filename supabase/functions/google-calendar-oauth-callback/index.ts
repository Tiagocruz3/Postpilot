import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = JSON.parse(atob(url.searchParams.get('state') || '{}'))
  const workspaceId = state.workspace_id
  const redirectUri = `${url.origin}/google-calendar-oauth-callback`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code!,
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      redirect_uri: redirectUri,
    }),
  })
  const tokenData = await tokenRes.json()

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: { user } } = await supabase.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', '') || '')
  if (!user) return new Response('Unauthorized', { status: 401 })

  await supabase.from('user_integrations').upsert({
    user_id: user.id,
    workspace_id: workspaceId,
    provider: 'google',
    access_token_encrypted: tokenData.access_token,
    token_iv: '',
    refresh_token_encrypted: tokenData.refresh_token || null,
    expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
    metadata: {},
  }, { onConflict: 'user_id,workspace_id,provider' })

  return new Response(null, { status: 302, headers: { Location: `${Deno.env.get('APP_URL') || url.origin}/settings` } })
})
