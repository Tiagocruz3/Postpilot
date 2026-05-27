import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { appRedirect, decodeOAuthState, getAdminClient, getUserIdFromState, oauthCallbackUri } from '../_shared/oauth.ts'

serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = decodeOAuthState(url.searchParams.get('state'))
  const workspaceId = state.workspace_id as string | undefined
  const userId = getUserIdFromState(state)
  const redirectUri = oauthCallbackUri(req, 'meta-oauth-callback')

  if (!code || !workspaceId || !userId) {
    return new Response('Invalid OAuth callback', { status: 400 })
  }

  const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${Deno.env.get('META_APP_ID')}&client_secret=${Deno.env.get('META_APP_SECRET')}&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`
  const tokenData = await (await fetch(tokenUrl)).json()

  const accountsRes = await fetch(`https://graph.facebook.com/v18.0/me/adaccounts?access_token=${tokenData.access_token}`)
  const accountsData = await accountsRes.json()

  const supabase = getAdminClient()
  await supabase.from('user_integrations').upsert({
    user_id: userId,
    workspace_id: workspaceId,
    provider: 'meta',
    access_token_encrypted: tokenData.access_token,
    token_iv: '',
    refresh_token_encrypted: tokenData.access_token,
    expires_at: new Date(Date.now() + (tokenData.expires_in || 5184000) * 1000).toISOString(),
    metadata: { ad_accounts: accountsData.data || [] },
  }, { onConflict: 'user_id,workspace_id,provider' })

  return new Response(null, { status: 302, headers: { Location: appRedirect('/ads?oauth=meta&status=connected') } })
})
