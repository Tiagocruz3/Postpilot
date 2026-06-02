import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, ExternalLink, Loader2, RefreshCcw, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Campaign = {
  id: string
  name: string
  status: string
  objective: string
  effective_status: string
  daily_budget?: string
  lifetime_budget?: string
  start_time?: string
  created_time?: string
  updated_time?: string
  insights?: {
    impressions?: string
    clicks?: string
    spend?: string
    ctr?: string
    cpc?: string
    reach?: string
    leads?: string
  } | null
}

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_TRAFFIC: 'Traffic',
  OUTCOME_AWARENESS: 'Awareness',
  OUTCOME_ENGAGEMENT: 'Engagement',
  OUTCOME_LEADS: 'Leads',
  OUTCOME_SALES: 'Sales',
  OUTCOME_APP_PROMOTION: 'App promotion',
}

const OBJECTIVE_BADGE: Record<string, string> = {
  OUTCOME_TRAFFIC: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  OUTCOME_AWARENESS: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  OUTCOME_ENGAGEMENT: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  OUTCOME_LEADS: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  OUTCOME_SALES: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
  OUTCOME_APP_PROMOTION: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400',
}

const ALL = 'all'

type LiveAdsPanelProps = {
  workspaceId: string | null
  metaAccountId: string | null
}

export function LiveAdsPanel({ workspaceId, metaAccountId }: LiveAdsPanelProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [objectiveFilter, setObjectiveFilter] = useState(ALL)

  const accountIdClean = metaAccountId?.replace(/^act_/, '') ?? null

  const load = useCallback(async () => {
    if (!workspaceId || !metaAccountId) return
    setLoading(true)
    setError('')
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('meta-ads', {
        body: {
          action: 'list_campaigns',
          workspace_id: workspaceId,
          account_id: metaAccountId,
          status: 'ACTIVE',
        },
      })
      if (fnErr) throw new Error(fnErr.message)
      const rows: Campaign[] = (data?.data as Campaign[]) ?? []

      // Fetch insights for each active campaign in parallel (capped at 20).
      const withInsights = await Promise.all(
        rows.slice(0, 20).map(async (c) => {
          try {
            const { data: ins } = await supabase.functions.invoke('meta-ads', {
              body: { action: 'insights', workspace_id: workspaceId, campaign_id: c.id },
            })
            const insight = Array.isArray(ins?.data) ? ins.data[0] : null
            return { ...c, insights: insight ?? null }
          } catch {
            return { ...c, insights: null }
          }
        }),
      )
      setCampaigns(withInsights)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load live campaigns.')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, metaAccountId])

  useEffect(() => {
    void load()
  }, [load])

  const objectives = useMemo(() => {
    const seen = new Set<string>()
    for (const c of campaigns) if (c.objective) seen.add(c.objective)
    return Array.from(seen).sort()
  }, [campaigns])

  const filtered = useMemo(
    () => (objectiveFilter === ALL ? campaigns : campaigns.filter((c) => c.objective === objectiveFilter)),
    [campaigns, objectiveFilter],
  )

  const adsManagerUrl = (c: Campaign) => {
    const base = 'https://adsmanager.facebook.com/adsmanager/manage/campaigns'
    const params = new URLSearchParams()
    if (accountIdClean) params.set('act', accountIdClean)
    params.set('selected_campaign_ids', c.id)
    return `${base}?${params.toString()}`
  }

  if (!metaAccountId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <Activity className="h-6 w-6 text-muted-foreground/40" />
          Connect a Meta ad account in Settings to see live campaigns.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-500" />
            Live campaigns
            {campaigns.length > 0 ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px]">
                {campaigns.length} active
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>All currently running ads on this Meta account, with live metrics.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCcw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {/* Objective filter pills */}
        {objectives.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            <FilterPill label="All" active={objectiveFilter === ALL} onClick={() => setObjectiveFilter(ALL)} />
            {objectives.map((obj) => (
              <FilterPill
                key={obj}
                label={OBJECTIVE_LABELS[obj] ?? obj}
                active={objectiveFilter === obj}
                className={objectiveFilter === obj ? (OBJECTIVE_BADGE[obj] ?? '') : ''}
                onClick={() => setObjectiveFilter(obj)}
              />
            ))}
          </div>
        ) : null}

        {loading && campaigns.length === 0 ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 && !loading ? (
          <div className="rounded-xl border border-dashed bg-muted/10 p-8 text-center text-sm text-muted-foreground">
            <Activity className="mx-auto mb-2 h-5 w-5 text-muted-foreground/40" />
            {campaigns.length === 0
              ? 'No active campaigns found. Activate an ad from the Ad Library to see it here.'
              : 'No active campaigns match this objective filter.'}
          </div>
        ) : (
          <div className="divide-y rounded-xl border">
            {filtered.map((c) => (
              <CampaignRow key={c.id} campaign={c} adsManagerUrl={adsManagerUrl(c)} loading={loading} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CampaignRow({
  campaign: c,
  adsManagerUrl,
  loading,
}: {
  campaign: Campaign
  adsManagerUrl: string
  loading: boolean
}) {
  const objLabel = OBJECTIVE_LABELS[c.objective] ?? c.objective ?? 'Unknown'
  const objBadge = OBJECTIVE_BADGE[c.objective] ?? 'bg-muted text-muted-foreground'
  const ins = c.insights

  const budget = c.daily_budget
    ? `$${(Number(c.daily_budget) / 100).toFixed(2)}/day`
    : c.lifetime_budget
    ? `$${(Number(c.lifetime_budget) / 100).toFixed(2)} lifetime`
    : null

  return (
    <div className="flex flex-col gap-3 px-4 py-4 first:rounded-t-xl last:rounded-b-xl sm:flex-row sm:items-center">
      {/* Name + objective */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium leading-tight">{c.name}</p>
          <Badge variant="secondary" className={cn('shrink-0 text-[10px] capitalize', objBadge)}>
            {objLabel}
          </Badge>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        </div>
        {budget ? <p className="mt-0.5 text-xs text-muted-foreground">{budget}</p> : null}
      </div>

      {/* Metrics */}
      <div className="flex shrink-0 flex-wrap gap-4 text-right text-sm sm:gap-5">
        <Metric label="Spend" value={ins?.spend ? `$${Number(ins.spend).toFixed(2)}` : loading ? '...' : '-'} />
        <Metric label="Reach" value={ins?.reach ? Number(ins.reach).toLocaleString() : loading ? '...' : '-'} />
        <Metric label="Impressions" value={ins?.impressions ? Number(ins.impressions).toLocaleString() : loading ? '...' : '-'} />
        <Metric label="Clicks" value={ins?.clicks ? Number(ins.clicks).toLocaleString() : loading ? '...' : '-'} />
        <Metric label="CTR" value={ins?.ctr ? `${Number(ins.ctr).toFixed(2)}%` : loading ? '...' : '-'} />
        {c.objective === 'OUTCOME_LEADS' ? (
          <Metric label="Leads" value={ins?.leads ? Number(ins.leads).toLocaleString() : loading ? '...' : '-'} highlight />
        ) : null}
      </div>

      {/* Ads Manager link */}
      <a
        href={adsManagerUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Open in Ads Manager"
        className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
      >
        <ExternalLink className="h-4 w-4 text-[#1877F2]" />
      </a>
    </div>
  )
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="min-w-[48px]">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn('font-semibold tabular-nums', highlight && 'text-emerald-600 dark:text-emerald-400')}>
        {value}
      </p>
    </div>
  )
}

function FilterPill({
  label,
  active,
  onClick,
  className,
}: {
  label: string
  active: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active ? cn('border-transparent', className || 'bg-primary/10 text-primary') : 'hover:bg-muted',
      )}
    >
      {label}
    </button>
  )
}
