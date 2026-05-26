import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { encodeOAuthState, oauthCallbackUri, resolveUserIdFromStart } from '../_shared/oauth.ts'

serve(async (req) => {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspace_id')
  const userId = await resolveUserIdFromStart(req)

  if (!workspaceId || !userId) {
    return new Response('Missing workspace_id or access_token', { status: 400 })
  }

  const state = encodeOAuthState({ workspace_id: workspaceId, user_id: userId, provider: 'google-calendar' })
  const redirectUri = oauthCallbackUri(req, 'google-calendar-oauth-callback')
  const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events')
  const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${Deno.env.get('GOOGLE_CLIENT_ID')}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=consent`
  return new Response(null, { status: 302, headers: { Location: googleUrl } })
})
