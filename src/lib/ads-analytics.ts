import { supabase } from '@/lib/supabase'
import { listAdCreatives, type AdCreative } from '@/lib/ads-creatives'

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last_7d'
  | 'last_14d'
  | 'last_30d'
  | 'last_90d'
  | 'lifetime'

export const DATE_RANGE_OPTIONS: Array<{ value: DateRangePreset; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7d', label: 'Last 7 days' },
  { value: 'last_14d', label: 'Last 14 days' },
  { value: 'last_30d', label: 'Last 30 days' },
  { value: 'last_90d', label: 'Last 90 days' },
  { value: 'lifetime', label: 'Lifetime' },
]

export type AdMetrics = {
  spend: number
  reach: number
  impressions: number
  clicks: number
  linkClicks: number
  ctr: number // %
  cpc: number // $
  cpm: number // $
  cpp: number // $ cost per 1000 people reached
  frequency: number
  leads: number
  conversions: number
  purchases: number
  roas: number
  videoViews25: number
  videoViews50: number
  videoViewsComplete: number
}

const EMPTY: AdMetrics = {
  spend: 0,
  reach: 0,
  impressions: 0,
  clicks: 0,
  linkClicks: 0,
  ctr: 0,
  cpc: 0,
  cpm: 0,
  cpp: 0,
  frequency: 0,
  leads: 0,
  conversions: 0,
  purchases: 0,
  roas: 0,
  videoViews25: 0,
  videoViews50: 0,
  videoViewsComplete: 0,
}

export const EMPTY_METRICS = EMPTY

type ActionRow = { action_type?: string; value?: string | number }

function sumActions(actions: ActionRow[] | undefined, ...types: string[]): number {
  if (!Array.isArray(actions)) return 0
  const accepted = new Set(types)
  let total = 0
  for (const action of actions) {
    if (!action) continue
    if (accepted.has(action.action_type ?? '')) {
      const value = Number(action.value ?? 0)
      if (Number.isFinite(value)) total += value
    }
  }
  return total
}

function pickRoas(insight: Record<string, unknown>): number {
  const fromPurchase = Array.isArray(insight.website_purchase_roas)
    ? (insight.website_purchase_roas as ActionRow[])[0]?.value
    : undefined
  const fromAny = Array.isArray(insight.purchase_roas)
    ? (insight.purchase_roas as ActionRow[])[0]?.value
    : undefined
  return Number(fromPurchase ?? fromAny ?? 0) || 0
}

function normalizeInsight(row: Record<string, unknown> | null | undefined): AdMetrics {
  if (!row) return { ...EMPTY }
  const actions = (row.actions as ActionRow[] | undefined) ?? undefined
  const num = (key: string) => {
    const value = Number((row as Record<string, unknown>)[key] ?? 0)
    return Number.isFinite(value) ? value : 0
  }
  const leads = sumActions(actions, 'lead', 'onsite_conversion.lead_grouped', 'leadgen.other')
  const purchases = sumActions(
    actions,
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
    'app_custom_event.fb_mobile_purchase',
  )
  const conversions = sumActions(actions, 'offsite_conversion', 'omni_complete_registration', 'complete_registration')
  return {
    spend: num('spend'),
    reach: num('reach'),
    impressions: num('impressions'),
    clicks: num('clicks'),
    linkClicks: num('inline_link_clicks'),
    ctr: num('ctr'),
    cpc: num('cpc'),
    cpm: num('cpm'),
    cpp: num('cpp'),
    frequency: num('frequency'),
    leads,
    conversions: conversions + purchases,
    purchases,
    roas: pickRoas(row),
    videoViews25: sumActions((row.video_p25_watched_actions as ActionRow[]) ?? undefined, 'video_view'),
    videoViews50: sumActions((row.video_p50_watched_actions as ActionRow[]) ?? undefined, 'video_view'),
    videoViewsComplete: sumActions((row.video_p100_watched_actions as ActionRow[]) ?? undefined, 'video_view'),
  }
}

export function emptyMetrics(): AdMetrics {
  return { ...EMPTY }
}

export function sumMetrics(rows: AdMetrics[]): AdMetrics {
  const out: AdMetrics = { ...EMPTY }
  for (const row of rows) {
    out.spend += row.spend
    out.reach += row.reach
    out.impressions += row.impressions
    out.clicks += row.clicks
    out.linkClicks += row.linkClicks
    out.leads += row.leads
    out.conversions += row.conversions
    out.purchases += row.purchases
    out.videoViews25 += row.videoViews25
    out.videoViews50 += row.videoViews50
    out.videoViewsComplete += row.videoViewsComplete
  }
  // Derived
  out.ctr = out.impressions > 0 ? (out.clicks / out.impressions) * 100 : 0
  out.cpc = out.clicks > 0 ? out.spend / out.clicks : 0
  out.cpm = out.impressions > 0 ? (out.spend / out.impressions) * 1000 : 0
  out.cpp = out.reach > 0 ? (out.spend / out.reach) * 1000 : 0
  out.frequency = out.reach > 0 ? out.impressions / out.reach : 0
  const roasValues = rows.map((r) => r.roas).filter((v) => v > 0)
  out.roas = roasValues.length > 0 ? roasValues.reduce((a, b) => a + b, 0) / roasValues.length : 0
  return out
}

/** Fetch insights for one Meta ad/adset/campaign id. */
async function fetchInsightsFor(
  workspaceId: string,
  target: { meta_ad_id?: string | null; meta_adset_id?: string | null; meta_campaign_id?: string | null },
  preset: DateRangePreset,
): Promise<AdMetrics> {
  const body: Record<string, unknown> = {
    action: 'insights',
    workspace_id: workspaceId,
    date_preset: preset === 'lifetime' ? 'maximum' : preset,
  }
  if (target.meta_ad_id) body.ad_id = target.meta_ad_id
  else if (target.meta_adset_id) body.adset_id = target.meta_adset_id
  else if (target.meta_campaign_id) body.campaign_id = target.meta_campaign_id
  else return emptyMetrics()
  try {
    const { data, error } = await supabase.functions.invoke('meta-ads', { body })
    if (error) throw error
    const row = Array.isArray(data?.data) ? (data.data[0] as Record<string, unknown>) : null
    return normalizeInsight(row)
  } catch (err) {
    console.warn('[ads-analytics] meta insights failed', err)
    return emptyMetrics()
  }
}

export type AnalyticsRow = {
  creative: AdCreative
  metrics: AdMetrics
  /** True when metrics could not be loaded (no Meta link or insight call failed). */
  metricsUnavailable: boolean
}

export type LoadAnalyticsParams = {
  workspaceId: string
  preset: DateRangePreset
  /** Cap how many creatives we attempt to enrich (each costs an API call). */
  maxEnriched?: number
}

/** Loads creatives + enriches each with Meta insights when possible. */
export async function loadAdAnalytics({
  workspaceId,
  preset,
  maxEnriched = 30,
}: LoadAnalyticsParams): Promise<AnalyticsRow[]> {
  const creatives = await listAdCreatives({ workspaceId, status: 'all', limit: 100 })
  const rows: AnalyticsRow[] = []
  let enriched = 0
  for (const creative of creatives) {
    const hasMeta = Boolean(creative.meta_ad_id || creative.meta_adset_id || creative.meta_campaign_id)
    if (hasMeta && enriched < maxEnriched) {
      enriched += 1
      const metrics = await fetchInsightsFor(workspaceId, creative, preset)
      rows.push({ creative, metrics, metricsUnavailable: false })
    } else {
      rows.push({ creative, metrics: emptyMetrics(), metricsUnavailable: hasMeta === false })
    }
  }
  return rows
}

export function fmtCurrency(value: number, currency = 'USD'): string {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString(undefined, { style: 'currency', currency, maximumFractionDigits: value >= 100 ? 0 : 2 })
}

export function fmtNumber(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `${(value / 1000).toFixed(1)}K`
  return Math.round(value).toLocaleString()
}

export function fmtPercent(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `${value.toFixed(2)}%`
}

export function fmtRatio(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '—'
  return `${value.toFixed(2)}x`
}
