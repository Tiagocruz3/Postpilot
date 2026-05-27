import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { encodeOAuthState, oauthCallbackUri, resolveUserIdFromStart } from '../_shared/oauth.ts'

serve(async (req) => {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspace_id')
  const userId = await resolveUserIdFromStart(req)

  if (!workspaceId || !userId) {
    return new Response('Missing workspace_id or access_token', { status: 400 })
  }

  const state = encodeOAuthState({ workspace_id: workspaceId, user_id: userId, provider: 'linkedin' })
  const redirectUri = oauthCallbackUri(req, 'linkedin-oauth-callback')
  const scope = encodeURIComponent('w_member_social w_organization_social r_liteprofile r_organization_admin')
  const linkedinUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${Deno.env.get('LINKEDIN_CLIENT_ID')}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`
  return new Response(null, { status: 302, headers: { Location: linkedinUrl } })
})
