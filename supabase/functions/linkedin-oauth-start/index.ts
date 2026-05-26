import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

serve(async (req) => {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspace_id')
  const state = btoa(JSON.stringify({ workspace_id: workspaceId, provider: 'linkedin' }))
  const redirectUri = `${url.origin}/linkedin-oauth-callback`
  const linkedinUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${Deno.env.get('LINKEDIN_CLIENT_ID')}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=w_member_social%20r_liteprofile&state=${state}`
  return new Response(null, { status: 302, headers: { Location: linkedinUrl } })
})
