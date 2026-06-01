import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, ChevronRight, Loader2, MapPin, Sparkles, Target, Users, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AD_PLACEMENTS,
  FacebookAdPreview,
  type AdDevice,
  type AdPlacement,
} from '@/components/ads/FacebookAdPreview'
import {
  AD_CREATIVE_STATUS_LABELS,
  listAdCreatives,
  type AdCreative,
  type AdCreativeStatus,
} from '@/lib/ads-creatives'
import { publishCreativeToMeta, setMetaAdStatus } from '@/lib/ads-publish'
import { fetchAdsStudioProfile } from '@/lib/ads-studio-profile'
import { useAuth } from '@/hooks/useAuth'
import {
  DATE_RANGE_OPTIONS,
  fmtCurrency,
  fmtNumber,
  fmtPercent,
  fmtRatio,
  loadAdAnalytics,
  loadAdTrends,
  type AdMetrics,
  type DateRangePreset,
  type TrendPoint,
} from '@/lib/ads-analytics'
import { Sparkline } from '@/components/ads/Sparkline'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface OutletContext {
  currentWorkspaceId: string | null
}

type AiSuggestion = {
  title: string
  category: string
  impact: 'high' | 'medium' | 'low'
  rationale: string
  action: string
}

type AiInsights = {
  summary: string
  verdict: 'winning' | 'underperforming' | 'promising' | 'needs_review' | 'untested'
  suggestions: AiSuggestion[]
}

const VERDICT_STYLE: Record<AiInsights['verdict'], string> = {
  winning: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  underperforming: 'border-destructive/30 bg-destructive/10 text-destructive',
  promising: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  needs_review: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  untested: 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
}

const IMPACT_STYLE: Record<AiSuggestion['impact'], string> = {
  high: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  low: 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
}

export function AdDetailPage() {
  const { creativeId } = useParams<{ creativeId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { currentWorkspaceId } = useOutletContext<OutletContext>()
  const [creative, setCreative] = useState<AdCreative | null>(null)
  const [metrics, setMetrics] = useState<AdMetrics | null>(null)
  const [trends, setTrends] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [preset, setPreset] = useState<DateRangePreset>('last_30d')
  const [placement, setPlacement] = useState<AdPlacement>('facebook-feed')
  const [device, setDevice] = useState<AdDevice>('mobile')
  const [insights, setInsights] = useState<AiInsights | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<'publish' | 'pause' | 'resume' | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [metaAccountId, setMetaAccountId] = useState<string | null>(null)
  const [facebookPageId, setFacebookPageId] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState<string>('Your Page')

  useEffect(() => {
    if (!currentWorkspaceId || !user?.id) return
    void fetchAdsStudioProfile(currentWorkspaceId, user.id).then((profile) => {
      const id = profile?.metaConnection?.adAccountId
      setMetaAccountId(id ? `act_${id.replace(/^act_/, '')}` : null)
      setFacebookPageId(profile?.metaConnection?.facebookPageId || null)
      setBusinessName(profile?.businessProfile?.businessName || 'Your Page')
    })
  }, [currentWorkspaceId, user?.id])

  const pageAvatarUrl = facebookPageId
    ? `https://graph.facebook.com/${encodeURIComponent(facebookPageId)}/picture?type=large`
    : null

  const reload = useCallback(async () => {
    if (!currentWorkspaceId || !creativeId) return
    setLoading(true)
    setError(null)
    try {
      const all = await listAdCreatives({ workspaceId: currentWorkspaceId, status: 'all', limit: 200 })
      const found = all.find((row) => row.id === creativeId) ?? null
      if (!found) {
        setError('Ad not found in this workspace.')
        setCreative(null)
        setMetrics(null)
        return
      }
      setCreative(found)
      const analytics = await loadAdAnalytics({ workspaceId: currentWorkspaceId, preset, maxEnriched: 1 })
      const row = analytics.find((r) => r.creative.id === creativeId)
      setMetrics(row?.metrics ?? null)
      const hasMeta = Boolean(found.meta_ad_id || found.meta_adset_id || found.meta_campaign_id)
      if (hasMeta) {
        const series = await loadAdTrends({
          workspaceId: currentWorkspaceId,
          target: {
            meta_ad_id: found.meta_ad_id,
            meta_adset_id: found.meta_adset_id,
            meta_campaign_id: found.meta_campaign_id,
          },
          preset,
        })
        setTrends(series)
      } else {
        setTrends([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ad')
    } finally {
      setLoading(false)
    }
  }, [creativeId, currentWorkspaceId, preset])

  useEffect(() => {
    void reload()
  }, [reload])

  const fetchInsights = useCallback(async () => {
    if (!creative || !currentWorkspaceId) return
    setInsightsLoading(true)
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('suggest-ad-improvements', {
        body: {
          creative,
          metrics: metrics ?? {},
          workspace_id: currentWorkspaceId,
        },
      })
      if (invokeErr) throw invokeErr
      setInsights({
        summary: String(data?.summary || ''),
        verdict: (data?.verdict as AiInsights['verdict']) || 'needs_review',
        suggestions: Array.isArray(data?.suggestions) ? (data.suggestions as AiSuggestion[]) : [],
      })
    } catch (err) {
      setInsights({
        summary: err instanceof Error ? err.message : 'Could not fetch AI insights.',
        verdict: 'needs_review',
        suggestions: [],
      })
    } finally {
      setInsightsLoading(false)
    }
  }, [creative, currentWorkspaceId, metrics])

  const handlePublish = useCallback(async () => {
    if (!creative || !currentWorkspaceId) return
    if (!metaAccountId) {
      setActionMessage('Connect a Meta ad account in Settings → Connections before publishing.')
      return
    }
    setActionLoading('publish')
    setActionMessage(null)
    const result = await publishCreativeToMeta({
      creativeId: creative.id,
      workspaceId: currentWorkspaceId,
      metaAccountId,
    })
    setActionLoading(null)
    if (!result.ok) {
      setActionMessage(`Publish failed: ${result.error ?? 'Unknown error'}`)
      return
    }
    const note = result.warnings && result.warnings.length > 0 ? ` ${result.warnings.join(' ')}` : ''
    setActionMessage(`Ad created on Meta as PAUSED (id ${result.ad_id}). Activate from Meta Ads Manager.${note}`)
    void reload()
  }, [creative, currentWorkspaceId, metaAccountId, reload])

  const handleSetStatus = useCallback(
    async (next: 'ACTIVE' | 'PAUSED') => {
      if (!creative?.meta_ad_id || !currentWorkspaceId) return
      setActionLoading(next === 'ACTIVE' ? 'resume' : 'pause')
      setActionMessage(null)
      const result = await setMetaAdStatus({
        workspaceId: currentWorkspaceId,
        creativeId: creative.id,
        metaAdId: creative.meta_ad_id,
        status: next,
      })
      setActionLoading(null)
      if (!result.ok) {
        setActionMessage(`Failed to update Meta status: ${result.error ?? 'Unknown error'}`)
        return
      }
      setActionMessage(next === 'ACTIVE' ? 'Ad activated on Meta.' : 'Ad paused on Meta.')
      void reload()
    },
    [creative, currentWorkspaceId, reload],
  )

  const destinationDomain = useMemo(() => {
    if (!creative?.destination_url) return ''
    try {
      return new URL(creative.destination_url).hostname.replace(/^www\./, '')
    } catch {
      return creative.destination_url.replace(/^https?:\/\//, '').split('/')[0]
    }
  }, [creative?.destination_url])

  if (loading && !creative) {
    return (
      <div className="mx-auto flex h-64 max-w-6xl items-center justify-center px-6 py-6 md:px-10 md:py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !creative) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-6 py-6 md:px-10 md:py-8">
        <Button variant="outline" size="sm" onClick={() => navigate('/app/ads')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Ads
        </Button>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">{error ?? 'Ad not found.'}</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-6 md:px-10 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate('/app/ads')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Ads
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {creative.meta_ad_id ? (
            <>
              {creative.status === 'paused' ? (
                <Button
                  size="sm"
                  onClick={() => void handleSetStatus('ACTIVE')}
                  disabled={actionLoading !== null}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {actionLoading === 'resume' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Activate on Meta
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleSetStatus('PAUSED')}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'pause' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Pause on Meta
                </Button>
              )}
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => void handlePublish()}
              disabled={actionLoading !== null}
              className="bg-[#1877F2] hover:bg-[#166fe0]"
            >
              {actionLoading === 'publish' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Publish to Meta
            </Button>
          )}
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as DateRangePreset)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {DATE_RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {actionMessage ? (
        <div className="rounded-xl border border-[#1877F2]/30 bg-[#1877F2]/5 px-4 py-3 text-sm">
          {actionMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {creative.campaign_name || creative.headline || 'Ad detail'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {creative.variant_label}
            {creative.angle ? ` · ${creative.angle.replace(/-/g, ' ')} angle` : ''}
            {creative.is_selected_variant ? ' · Selected variant' : ''}
          </p>
        </div>
        <StatusBadge status={creative.status} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] xl:gap-10">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Performance</CardTitle>
              <CardDescription>
                {metrics && metrics.impressions > 0
                  ? `Meta Ads insights for ${labelForPreset(preset)}.`
                  : 'No live metrics yet. Publish this ad to start collecting performance data.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Kpi label="Spend" value={fmtCurrency(metrics?.spend ?? 0)} accent="text-[#1877F2]" trend={trends.map((t) => t.spend)} />
                <Kpi label="Reach" value={fmtNumber(metrics?.reach ?? 0)} trend={trends.map((t) => t.reach)} />
                <Kpi label="Impressions" value={fmtNumber(metrics?.impressions ?? 0)} trend={trends.map((t) => t.impressions)} />
                <Kpi label="Clicks" value={fmtNumber(metrics?.clicks ?? 0)} trend={trends.map((t) => t.clicks)} />
                <Kpi label="CTR" value={fmtPercent(metrics?.ctr ?? 0)} trend={trends.map((t) => t.ctr)} />
                <Kpi label="CPC" value={fmtCurrency(metrics?.cpc ?? 0)} trend={trends.map((t) => t.cpc)} />
                <Kpi label="CPM" value={fmtCurrency(metrics?.cpm ?? 0)} trend={trends.map((t) => t.cpm)} />
                <Kpi label="Frequency" value={metrics?.frequency ? metrics.frequency.toFixed(2) : ' - '} />
                <Kpi label="Leads" value={fmtNumber(metrics?.leads ?? 0)} trend={trends.map((t) => t.leads)} />
                <Kpi label="Conversions" value={fmtNumber(metrics?.conversions ?? 0)} trend={trends.map((t) => t.conversions)} />
                <Kpi label="Purchases" value={fmtNumber(metrics?.purchases ?? 0)} />
                <Kpi label="ROAS" value={fmtRatio(metrics?.roas ?? 0)} accent="text-emerald-600" />
                <Kpi label="Video 25%" value={fmtNumber(metrics?.videoViews25 ?? 0)} />
                <Kpi label="Video 50%" value={fmtNumber(metrics?.videoViews50 ?? 0)} />
                <Kpi label="Video Complete" value={fmtNumber(metrics?.videoViewsComplete ?? 0)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
              <div>
                <CardTitle className="text-base">AI performance review</CardTitle>
                <CardDescription>
                  Diagnoses how the ad is doing and gives specific changes to try next.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => void fetchInsights()} disabled={insightsLoading}>
                {insightsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {insights ? 'Refresh insights' : 'Generate insights'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {!insights && !insightsLoading ? (
                <p className="text-sm text-muted-foreground">
                  Click <span className="font-medium text-foreground">Generate insights</span> for AI-driven optimisation tips
                  based on this ad's creative and performance.
                </p>
              ) : null}
              {insights ? (
                <>
                  <div className={cn('rounded-xl border px-3 py-2 text-sm', VERDICT_STYLE[insights.verdict])}>
                    <p className="text-xs font-semibold uppercase tracking-wide">
                      Verdict · {insights.verdict.replace(/_/g, ' ')}
                    </p>
                    <p className="mt-1 text-sm text-foreground/90">{insights.summary}</p>
                  </div>
                  {insights.suggestions.length > 0 ? (
                    <div className="space-y-2">
                      {insights.suggestions.map((s, i) => (
                        <div key={i} className="rounded-xl border bg-card p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              <p className="text-sm font-semibold">{s.title}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {s.category}
                              </Badge>
                              <Badge variant="outline" className={cn('text-[10px]', IMPACT_STYLE[s.impact])}>
                                {s.impact} impact
                              </Badge>
                            </div>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{s.rationale}</p>
                          <p className="mt-2 rounded-lg bg-muted/40 px-2 py-1.5 text-xs">
                            <span className="font-medium text-foreground">Try this: </span>
                            {s.action}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row icon={<Target className="h-4 w-4" />} label="Goal" value={creative.goal || ' - '} />
              <Row
                icon={<Wallet className="h-4 w-4" />}
                label="Budget"
                value={
                  creative.budget?.type === 'lifetime'
                    ? `$${creative.budget?.lifetime ?? ' - '} lifetime`
                    : `$${creative.budget?.daily ?? ' - '} / day`
                }
              />
              <Row
                icon={<Users className="h-4 w-4" />}
                label="Audience"
                value={`${creative.audience?.location ?? ' - '} · ${creative.audience?.age_min ?? ' - '}-${creative.audience?.age_max ?? ' - '} · ${(creative.audience?.genders ?? []).join(', ') || 'all'}`}
              />
              <Row
                icon={<Calendar className="h-4 w-4" />}
                label="Schedule"
                value={`${creative.schedule_start ?? ' - '} → ${creative.schedule_end ?? 'open ended'}`}
              />
              <Row
                icon={<MapPin className="h-4 w-4" />}
                label="Placements"
                value={
                  Array.isArray(creative.placements) && creative.placements.length > 0
                    ? creative.placements.join(', ')
                    : 'Auto'
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ad preview</CardTitle>
              <CardDescription>
                Pick a placement and device - one surface at a time so nothing overlaps.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PlacementSwitcher
                placement={placement}
                device={device}
                onPlacement={setPlacement}
                onDevice={setDevice}
              />
              <div className="flex min-h-[280px] justify-center overflow-x-auto rounded-xl border bg-muted/10 p-4 sm:p-6">
                <FacebookAdPreview
                  data={{
                    pageName: businessName,
                    pageAvatarUrl,
                    primaryText: creative.primary_text,
                    headline: creative.headline,
                    description: creative.description ?? undefined,
                    cta: creative.cta,
                    mediaUrl: creative.media_url,
                    mediaType: (creative.media_type as 'image' | 'video' | undefined) ?? 'image',
                    destinationDomain,
                  }}
                  placement={placement}
                  device={device}
                />
              </div>
              <p className="text-center text-[11px] text-muted-foreground">
                Showing{' '}
                <span className="font-medium text-foreground">
                  {AD_PLACEMENTS.find((p) => p.id === placement)?.label}
                </span>{' '}
                on {device === 'mobile' ? 'mobile' : 'desktop'}.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function PlacementSwitcher({
  placement,
  device,
  onPlacement,
  onDevice,
}: {
  placement: AdPlacement
  device: AdDevice
  onPlacement: (p: AdPlacement) => void
  onDevice: (d: AdDevice) => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Placement</p>
      <div className="flex flex-wrap gap-1.5">
        {AD_PLACEMENTS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onPlacement(id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
              placement === id
                ? 'border-[#1877F2] bg-[#1877F2] text-white shadow-sm'
                : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Device</p>
      <div className="inline-flex rounded-full border p-0.5">
        {(['mobile', 'desktop'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onDevice(value)}
            className={cn(
              'rounded-full px-3 py-1 text-[11px] font-medium capitalize transition-colors',
              device === value ? 'bg-[#1877F2] text-white' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: AdCreativeStatus }) {
  return <Badge variant="outline">{AD_CREATIVE_STATUS_LABELS[status]}</Badge>
}

function Kpi({
  label,
  value,
  accent,
  trend,
}: {
  label: string
  value: string
  accent?: string
  trend?: number[]
}) {
  const hasTrend = Array.isArray(trend) && trend.length >= 2 && trend.some((v) => v > 0)
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className={cn('text-lg font-semibold tabular-nums', accent ?? 'text-foreground')}>{value}</p>
        {hasTrend ? <Sparkline values={trend!} width={64} height={20} /> : null}
      </div>
    </div>
  )
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate font-medium">{value}</p>
      </div>
    </div>
  )
}

function labelForPreset(preset: DateRangePreset): string {
  return DATE_RANGE_OPTIONS.find((opt) => opt.value === preset)?.label ?? preset
}
