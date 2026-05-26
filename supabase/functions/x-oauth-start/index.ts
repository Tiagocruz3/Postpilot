import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

function generatePKCE() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  const verifier = btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const hashBuffer = new TextEncoder().encode(verifier)
  return { verifier, challenge: '' }
}

serve(async (req) => {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspace_id')
  const state = btoa(JSON.stringify({ workspace_id: workspaceId, provider: 'x' }))
  const redirectUri = `${url.origin}/x-oauth-callback`
  const xUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${Deno.env.get('X_CLIENT_ID')}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=tweet.read%20tweet.write%20users.read%20offline.access&state=${state}&code_challenge=challenge&code_challenge_method=plain`
  return new Response(null, { status: 302, headers: { Location: xUrl } })
})
