import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { appRedirect, decodeOAuthState, getAdminClient, getUserIdFromState, oauthCallbackUri } from '../_shared/oauth.ts'

function redirectWithOAuthError(message: string) {
  try {
    const location = `${appRedirect('/settings')}?oauth_error=${encodeURIComponent(message)}`
    return new Response(null, { status: 302, headers: { Location: location } })
  } catch (_err) {
    return new Response(`Facebook OAuth error: ${message}`, {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}

function tokenExpiresAt(expiresIn: unknown) {
  const seconds = typeof expiresIn === 'number' && Number.isFinite(expiresIn) ? expiresIn : 60 * 60 * 24 * 60
  return new Date(Date.now() + seconds * 1000).toISOString()
}

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const oauthError = url.searchParams.get('error')
    const oauthErrorDescription = url.searchParams.get('error_description')
    if (oauthError) {
      return redirectWithOAuthError(oauthErrorDescription || oauthError)
    }

    let state: Record<string, unknown>
    try {
      state = decodeOAuthState(url.searchParams.get('state'))
    } catch (_err) {
      return redirectWithOAuthError('Could not decode OAuth state. Start the connect flow again.')
    }
    const workspaceId = state.workspace_id as string | undefined
    const userId = getUserIdFromState(state)
    const redirectUri = oauthCallbackUri(req, 'facebook-oauth-callback')

    if (!code || !workspaceId || !userId) {
      return new Response('Invalid OAuth callback', { status: 400 })
    }

    const metaAppId = Deno.env.get('META_APP_ID')
    const metaAppSecret = Deno.env.get('META_APP_SECRET')
    if (!metaAppId || !metaAppSecret) {
      return redirectWithOAuthError('Facebook OAuth is not configured (META_APP_ID / META_APP_SECRET missing on server).')
    }

    const tokenUrl =
      `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${metaAppId}&client_secret=${metaAppSecret}&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`
    const tokenData = await (await fetch(tokenUrl)).json()

    if (tokenData.error) {
      console.error('facebook-oauth-callback token error:', tokenData.error)
      return redirectWithOAuthError(tokenData.error.message || 'Facebook token exchange failed.')
    }

    if (!tokenData.access_token) {
      return redirectWithOAuthError('Facebook did not return an access token.')
    }

    const pagesRes = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${encodeURIComponent(tokenData.access_token)}`,
    )
    const pagesData = await pagesRes.json()

    if (pagesData.error) {
      console.error('facebook-oauth-callback pages error:', pagesData.error)
      return redirectWithOAuthError(pagesData.error.message || 'Failed to load Facebook Pages.')
    }

    const allPages = (pagesData.data ?? []) as Array<{ id?: string; name?: string; access_token?: string }>
    const validPages = allPages.filter(
      (p): p is { id: string; name: string; access_token: string } =>
        Boolean(p.id && p.name && p.access_token),
    )
    if (validPages.length === 0) {
      return redirectWithOAuthError(
        'No Facebook Page found. Create a Page or grant this app access to one, then connect again.',
      )
    }

    const primary = validPages[0]
    const instagramAccounts: Array<{ id: string; username: string; name: string; page_id: string; access_token: string }> = []

    for (const page of validPages) {
      try {
        const igRes = await fetch(
          `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account{id,username,name}&access_token=${encodeURIComponent(page.access_token)}`,
        )
        const igData = await igRes.json()
        const igAccount = igData.instagram_business_account as
          | { id?: string; username?: string; name?: string }
          | undefined
        if (igAccount?.id) {
          instagramAccounts.push({
            id: igAccount.id,
            username: igAccount.username || igAccount.id,
            name: igAccount.name || igAccount.username || 'Instagram account',
            page_id: page.id,
            access_token: page.access_token,
          })
        }
      } catch (err) {
        console.warn('facebook-oauth-callback instagram fetch skipped for page', page.id, err)
      }
    }

    const supabase = getAdminClient()
    const { error } = await supabase.from('user_integrations').upsert(
      {
        user_id: userId,
        workspace_id: workspaceId,
        provider: 'facebook',
        access_token_encrypted: primary.access_token,
        token_iv: '',
        refresh_token_encrypted: primary.access_token,
        expires_at: tokenExpiresAt(tokenData.expires_in),
        metadata: {
          page_id: primary.id,
          page_name: primary.name,
          selected_page_id: primary.id,
          pages: validPages.map((p) => ({ id: p.id, name: p.name, access_token: p.access_token })),
          instagram_accounts: instagramAccounts,
          selected_instagram_account_id: instagramAccounts[0]?.id ?? null,
        },
      },
      { onConflict: 'user_id,workspace_id,provider' },
    )

    if (error) {
      console.error('facebook-oauth-callback db error:', error)
      return redirectWithOAuthError(`Could not save Facebook connection: ${error.message ?? 'database error'}`)
    }

    return new Response(null, {
      status: 302,
      headers: { Location: appRedirect('/settings?oauth=facebook&status=connected') },
    })
  } catch (err) {
    console.error('facebook-oauth-callback:', err)
    const message = err instanceof Error ? err.message : 'Unexpected error during Facebook connect.'
    return redirectWithOAuthError(message)
  }
})
