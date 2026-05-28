import { supabase } from '@/lib/supabase'

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
    return { ok: false, error: error.message || 'Publish failed' }
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
  if (error) return { ok: false, error: error.message }
  if (data?.error) return { ok: false, error: typeof data.error === 'string' ? data.error : 'Status update failed' }
  return { ok: true }
}
