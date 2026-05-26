import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

export function getAdminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}

export async function resolveUserIdFromStart(req: Request): Promise<string | null> {
  const accessToken = new URL(req.url).searchParams.get('access_token')
  if (!accessToken) {
    return null
  }

  const { data: { user } } = await getAdminClient().auth.getUser(accessToken)
  return user?.id ?? null
}

export function encodeOAuthState(payload: Record<string, unknown>) {
  return btoa(JSON.stringify(payload))
}

export function decodeOAuthState(stateParam: string | null) {
  if (!stateParam) {
    return {} as Record<string, unknown>
  }

  return JSON.parse(atob(stateParam)) as Record<string, unknown>
}

export function getUserIdFromState(state: Record<string, unknown>) {
  return typeof state.user_id === 'string' ? state.user_id : null
}

export function appRedirect(path = '/settings') {
  const appUrl = Deno.env.get('APP_URL') || 'http://localhost:5173'
  return `${appUrl.replace(/\/$/, '')}${path}`
}

/** Canonical OAuth redirect URI for Supabase Edge Functions. */
export function oauthCallbackUri(req: Request, callbackName: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '')
  if (supabaseUrl) {
    return `${supabaseUrl}/functions/v1/${callbackName}`
  }

  const url = new URL(req.url)
  return `${url.origin}/functions/v1/${callbackName}`
}
