import { supabase } from '@/lib/supabase'

/**
 * `supabase.functions.invoke` surfaces a non-2xx response as a FunctionsHttpError
 * whose `.context` is the raw Response — its generic `.message` ("Edge Function
 * returned a non-2xx status code") hides the function's own error body. Read the
 * body so users see the real reason (e.g. a Meta API error detail).
 */
async function readFunctionError(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: unknown })?.context
  if (context instanceof Response) {
    try {
      const body = await context.clone().json()
      const detail = body?.detail?.error?.message ?? body?.detail?.message
      if (typeof body?.error === 'string') return detail ? `${body.error} — ${detail}` : body.error
      if (typeof detail === 'string') return detail
    } catch {
      try {
        const text = await context.clone().text()
        if (text) return text
      } catch {
        // ignore — fall through to message/fallback
      }
    }
  }
  const message = (error as { message?: unknown })?.message
  return typeof message === 'string' && message ? message : fallback
}

export type PublishResult = {
  ok: boolean
  campaign_id?: string
  adset_id?: string
  ad_id?: string
  uploaded_image?: boolean
  warnings?: string[]
  error?: string
}

export async function publishCreativeToMeta(params: {
  creativeId: string
  workspaceId: string
  metaAccountId: string
}): Promise<PublishResult> {
  const { data, error } = await supabase.functions.invoke('meta-ads', {
    body: {
      action: 'publish_ad',
      workspace_id: params.workspaceId,
      account_id: params.metaAccountId,
      creative_id: params.creativeId,
    },
  })
  if (error) {
    return { ok: false, error: await readFunctionError(error, 'Publish failed') }
  }
  if (data?.error) {
    return { ok: false, error: typeof data.error === 'string' ? data.error : 'Publish failed', warnings: data.warnings }
  }
  return {
    ok: true,
    campaign_id: data?.campaign_id,
    adset_id: data?.adset_id,
    ad_id: data?.ad_id,
    uploaded_image: data?.uploaded_image,
    warnings: data?.warnings,
  }
}

export async function setMetaAdStatus(params: {
  workspaceId: string
  creativeId?: string
  metaAdId: string
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DELETED'
}): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('meta-ads', {
    body: {
      action: 'set_ad_status',
      workspace_id: params.workspaceId,
      ad_id: params.metaAdId,
      status: params.status,
      creative_id: params.creativeId,
    },
  })
  if (error) return { ok: false, error: await readFunctionError(error, 'Status update failed') }
  if (data?.error) return { ok: false, error: typeof data.error === 'string' ? data.error : 'Status update failed' }
  return { ok: true }
}
