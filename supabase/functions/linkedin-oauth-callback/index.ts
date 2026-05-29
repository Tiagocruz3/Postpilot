import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { appRedirect, decodeOAuthState, getAdminClient, getUserIdFromState, oauthCallbackUri } from '../_shared/oauth.ts'

type LinkedInProfileOption = {
  id: string
  name: string
  type: 'person' | 'organization'
  author_urn: string
}

serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = decodeOAuthState(url.searchParams.get('state'))
  const workspaceId = state.workspace_id as string | undefined
  const userId = getUserIdFromState(state)
  const redirectUri = oauthCallbackUri(req, 'linkedin-oauth-callback')

  if (!code || !workspaceId || !userId) {
    return new Response('Invalid OAuth callback', { status: 400 })
  }

  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: Deno.env.get('LINKEDIN_CLIENT_ID')!,
      client_secret: Deno.env.get('LINKEDIN_CLIENT_SECRET')!,
      redirect_uri: redirectUri,
    }),
  })
  const tokenData = await tokenRes.json().catch(() => ({} as Record<string, unknown>))
  if (!tokenData.access_token) {
    // Surface LinkedIn's actual reason (e.g. invalid_client = wrong/expired
    // secret, invalid_redirect_uri, invalid_grant = code expired/reused).
    console.error('LinkedIn token exchange failed:', tokenRes.status, tokenData)
    const detail = tokenData.error_description || tokenData.error || `HTTP ${tokenRes.status}`
    return new Response(`LinkedIn token exchange failed: ${detail}`, { status: 400 })
  }

  const accessToken = tokenData.access_token as string

  // OpenID Connect userinfo (replaces the deprecated /v2/me + r_liteprofile).
  const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const profileData = await profileRes.json()
  // userinfo returns the member id in `sub`.
  const personId = (profileData.sub ?? profileData.id) as string | undefined
  if (!personId) {
    return new Response('Could not load LinkedIn profile', { status: 400 })
  }

  const personName =
    (typeof profileData.name === 'string' && profileData.name.trim()) ||
    [profileData.given_name, profileData.family_name].filter(Boolean).join(' ').trim() ||
    'Personal profile'

  const profiles: LinkedInProfileOption[] = [
    {
      id: personId,
      name: personName,
      type: 'person',
      author_urn: `urn:li:person:${personId}`,
    },
  ]

  try {
    const orgRes = await fetch(
      'https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organizationalTarget~(localizedName,id)))',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      },
    )
    if (orgRes.ok) {
      const orgData = await orgRes.json()
      const elements = (orgData.elements ?? []) as Array<{
        organizationalTarget?: { id?: number | string; localizedName?: string }
      }>
      for (const element of elements) {
        const orgId = element.organizationalTarget?.id
        if (!orgId) continue
        const orgIdStr = String(orgId)
        profiles.push({
          id: orgIdStr,
          name: element.organizationalTarget?.localizedName || `Organization ${orgIdStr}`,
          type: 'organization',
          author_urn: `urn:li:organization:${orgIdStr}`,
        })
      }
    }
  } catch (err) {
    console.warn('linkedin-oauth-callback org fetch skipped:', err)
  }

  const supabase = getAdminClient()
  await supabase.from('user_integrations').upsert(
    {
      user_id: userId,
      workspace_id: workspaceId,
      provider: 'linkedin',
      access_token_encrypted: accessToken,
      token_iv: '',
      refresh_token_encrypted: tokenData.refresh_token || null,
      expires_at: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
      metadata: {
        linkedin_id: personId,
        linkedin_name: personName,
        selected_profile_id: personId,
        profiles,
      },
    },
    { onConflict: 'user_id,workspace_id,provider' },
  )

  return new Response(null, { status: 302, headers: { Location: appRedirect('/settings') } })
})
