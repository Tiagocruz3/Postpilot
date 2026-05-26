import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

serve(async (req) => {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspace_id')
  const state = btoa(JSON.stringify({ workspace_id: workspaceId, provider: 'meta' }))
  const redirectUri = `${url.origin}/meta-oauth-callback`
  const metaUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${Deno.env.get('META_APP_ID')}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=ads_management,ads_read,business_management,pages_show_list&state=${state}&response_type=code`
  return new Response(null, { status: 302, headers: { Location: metaUrl } })
})
