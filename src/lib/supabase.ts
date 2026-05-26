import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const fallbackSupabaseUrl = 'https://example.supabase.co'
const fallbackSupabaseAnonKey = 'public-anon-key'

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = createClient<Database>(
  supabaseUrl ?? fallbackSupabaseUrl,
  supabaseAnonKey ?? fallbackSupabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
)

export function getEdgeFunctionUrl(functionName: string, params?: Record<string, string | null | undefined>) {
  if (!supabaseUrl) {
    return ''
  }

  const url = new URL(`/functions/v1/${functionName}`, supabaseUrl)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value)
      }
    })
  }

  return url.toString()
}

export function redirectToEdgeFunction(
  functionName: string,
  params?: Record<string, string | null | undefined>
) {
  const url = getEdgeFunctionUrl(functionName, params)
  if (!url) {
    throw new Error('Missing Supabase environment variables')
  }

  window.location.assign(url)
}

export const authConfig = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
}
