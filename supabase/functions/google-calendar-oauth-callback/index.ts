import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { appRedirect, decodeOAuthState, getAdminClient, getUserIdFromState, oauthCallbackUri } from '../_shared/oauth.ts'

serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = decodeOAuthState(url.searchParams.get('state'))
  const workspaceId = state.workspace_id as string | undefined
  const userId = getUserIdFromState(state)
  const redirectUri = oauthCallbackUri(req, 'google-calendar-oauth-callback')

  if (!code || !workspaceId || !userId) {
    return new Response('Invalid OAuth callback', { status: 400 })
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      redirect_uri: redirectUri,
    }),
  })
  const tokenData = await tokenRes.json()

  const supabase = getAdminClient()
  await supabase.from('user_integrations').upsert({
    user_id: userId,
    workspace_id: workspaceId,
    provider: 'google',
    access_token_encrypted: tokenData.access_token,
    token_iv: '',
    refresh_token_encrypted: tokenData.refresh_token || null,
    expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
    metadata: {},
  }, { onConflict: 'user_id,workspace_id,provider' })

  return new Response(null, { status: 302, headers: { Location: appRedirect('/settings') } })
})
