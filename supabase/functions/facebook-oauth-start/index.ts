import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

serve(async (req) => {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspace_id')
  const state = btoa(JSON.stringify({ workspace_id: workspaceId, provider: 'facebook' }))
  const redirectUri = `${url.origin}/facebook-oauth-callback`
  const fbUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${Deno.env.get('META_APP_ID')}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=pages_manage_posts,pages_read_engagement&state=${state}&response_type=code`
  return new Response(null, { status: 302, headers: { Location: fbUrl } })
})
