import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { encodeOAuthState, oauthCallbackUri, resolveUserIdFromStart } from '../_shared/oauth.ts'

serve(async (req) => {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspace_id')
  const userId = await resolveUserIdFromStart(req)

  if (!workspaceId || !userId) {
    return new Response('Missing workspace_id or access_token', { status: 400 })
  }

  const returnTo = url.searchParams.get('return_to') || '/settings?oauth=facebook&status=connected'
  const state = encodeOAuthState({ workspace_id: workspaceId, user_id: userId, provider: 'facebook', return_to: returnTo })
  const redirectUri = oauthCallbackUri(req, 'facebook-oauth-callback')
  const fbUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${Deno.env.get('META_APP_ID')}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=pages_manage_posts,pages_read_engagement&state=${state}&response_type=code`
  return new Response(null, { status: 302, headers: { Location: fbUrl } })
})
