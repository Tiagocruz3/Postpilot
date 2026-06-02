import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, ChevronDown, ChevronUp, Clock, ExternalLink, Loader2, Power, RefreshCcw, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useConfirm } from '@/components/ConfirmProvider'
import { setMetaCampaignStatus } from '@/lib/ads-publish'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Insights = {
  impressions?: string
  clicks?: string
  spend?: string
  ctr?: string
  cpc?: string
  reach?: string
  leads?: string
  actions?: Array<{ action_type: string; value: string }>
}

type Campaign = {
  id: string
  name: string
  status: string
  objective: string
  effective_status: string
  daily_budget?: string
  lifetime_budget?: string
  start_time?: string
  stop_time?: string
  created_time?: string
  updated_time?: string
  insights?: Insights | null
}

const OBJECTIVE_LABELS: Record<string, string> = {
  // Current ODAX objectives
  OUTCOME_TRAFFIC: 'Traffic',
  OUTCOME_AWARENESS: 'Awareness',
  OUTCOME_ENGAGEMENT: 'Engagement',
  OUTCOME_LEADS: 'Leads',
  OUTCOME_SALES: 'Sales',
  OUTCOME_APP_PROMOTION: 'App promotion',
  // Legacy objectives (pre-ODAX migration)
  CONVERSIONS: 'Conversions',
  LINK_CLICKS: 'Traffic',
  REACH: 'Reach',
  BRAND_AWARENESS: 'Awareness',
  PAGE_LIKES: 'Page likes',
  APP_INSTALLS: 'App installs',
  VIDEO_VIEWS: 'Video views',
  LEAD_GENERATION: 'Leads',
  MESSAGES: 'Messages',
  POST_ENGAGEMENT: 'Engagement',
  EVENT_RESPONSES: 'Event responses',
  LOCAL_AWARENESS: 'Local awareness',
  STORE_VISITS: 'Store visits',
}

const OBJECTIVE_BADGE: Record<string, string> = {
  // Current ODAX objectives
  OUTCOME_TRAFFIC: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  OUTCOME_AWARENESS: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  OUTCOME_ENGAGEMENT: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  OUTCOME_LEADS: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  OUTCOME_SALES: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
  OUTCOME_APP_PROMOTION: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400',
  // Legacy objectives — reuse closest modern colour
  CONVERSIONS: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
  LINK_CLICKS: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  REACH: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  BRAND_AWARENESS: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  PAGE_LIKES: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  APP_INSTALLS: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400',
  VIDEO_VIEWS: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400',
  LEAD_GENERATION: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  MESSAGES: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  POST_ENGAGEMENT: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  EVENT_RESPONSES: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  LOCAL_AWARENESS: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  STORE_VISITS: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
}

const STATUS_PILL: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  PAUSED: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  ARCHIVED: 'bg-zinc-500/10 text-zinc-500',
  COMPLETED: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  DELETED: 'bg-destructive/10 text-destructive',
}

const ALL = 'all'

function extractLeads(ins: Insights | null | undefined): string | null {
  if (!ins) return null
  if (ins.leads) return Number(ins.leads).toLocaleString()
  const leadAction = ins.actions?.find((a) => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped')
  return leadAction ? Number(leadAction.value).toLocaleString() : null
}

async function fetchInsights(workspaceId: string, campaignId: string, datePreset: string): Promise<Insights | null> {
  try {
    const { data } = await supabase.functions.invoke('meta-ads', {
      body: { action: 'insights', workspace_id: workspaceId, campaign_id: campaignId, date_preset: datePreset },
    })
    return Array.isArray(data?.data) ? (data.data[0] as Insights) ?? null : null
  } catch {
    return null
  }
}

async function loadCampaignsWithInsights(
  workspaceId: string,
  metaAccountId: string,
  statusFilter: string | null,
  datePreset: string,
): Promise<Campaign[]> {
  const { data, error } = await supabase.functions.invoke('meta-ads', {
    body: {
      action: 'list_campaigns',
      workspace_id: workspaceId,
      account_id: metaAccountId,
      status: statusFilter ?? undefined,
      limit: 100,
    },
  })
  if (error) throw new Error(error.message)
  const rows: Campaign[] = (data?.data as Campaign[]) ?? []

  return Promise.all(
    rows.slice(0, 50).map(async (c) => ({
      ...c,
      insights: await fetchInsights(workspaceId, c.id, datePreset),
    })),
  )
}

type LiveAdsPanelProps = {
  workspaceId: string | null
  metaAccountId: string | null
}

export function LiveAdsPanel({ workspaceId, metaAccountId }: LiveAdsPanelProps) {
  const confirm = useConfirm()
  const [liveCampaigns, setLiveCampaigns] = useState<Campaign[]>([])
  const [pastCampaigns, setPastCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [objectiveFilter, setObjectiveFilter] = useState(ALL)
  const [datePreset, setDatePreset] = useState('maximum')
  const [showPast, setShowPast] = useState(false)
  const [terminatingId, setTerminatingId] = useState<string | null>(null)

  const accountIdClean = metaAccountId?.replace(/^act_/, '') ?? null

  const load = useCallback(async () => {
    if (!workspaceId || !metaAccountId) return
    setLoading(true)
    setError('')
    try {
      const [live, past] = await Promise.all([
        loadCampaignsWithInsights(workspaceId, metaAccountId, 'ACTIVE', datePreset),
        loadCampaignsWithInsights(workspaceId, metaAccountId, null, datePreset).then((all) =>
          all.filter((c) => c.effective_status !== 'ACTIVE'),
        ),
      ])
      setLiveCampaigns(live)
      setPastCampaigns(past)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load campaigns.')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, metaAccountId, datePreset])

  useEffect(() => {
    void load()
  }, [load])

  // "Turn off" a live campaign — pauses it on Meta so all its ad sets + ads stop
  // spending. Optimistically moves the row out of "Live now" then refetches.
  const handleTerminate = useCallback(
    async (campaign: Campaign) => {
      if (!workspaceId) return
      const ok = await confirm({
        title: `Turn off "${campaign.name}"?`,
        description:
          'This pauses the campaign on Meta — all of its ad sets and ads stop spending immediately. You can turn it back on later from Meta Ads Manager.',
        confirmLabel: 'Turn off',
        variant: 'destructive',
      })
      if (!ok) return
      setError('')
      setTerminatingId(campaign.id)
      try {
        const result = await setMetaCampaignStatus({
          workspaceId,
          campaignId: campaign.id,
          status: 'PAUSED',
        })
        if (!result.ok) {
          setError(result.error ?? 'Could not turn off this campaign.')
          return
        }
        // Reflect the change immediately, then refetch for fresh statuses.
        setLiveCampaigns((list) => list.filter((c) => c.id !== campaign.id))
        setPastCampaigns((list) => [{ ...campaign, effective_status: 'PAUSED', status: 'PAUSED' }, ...list])
        void load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not turn off this campaign.')
      } finally {
        setTerminatingId(null)
      }
    },
    [workspaceId, confirm, load],
  )

  const allCampaigns = useMemo(() => [...liveCampaigns, ...pastCampaigns], [liveCampaigns, pastCampaigns])

  const objectives = useMemo(() => {
    const seen = new Set<string>()
    for (const c of allCampaigns) if (c.objective) seen.add(c.objective)
    return Array.from(seen).sort()
  }, [allCampaigns])

  const filteredLive = useMemo(
    () => (objectiveFilter === ALL ? liveCampaigns : liveCampaigns.filter((c) => c.objective === objectiveFilter)),
    [liveCampaigns, objectiveFilter],
  )

  const filteredPast = useMemo(
    () => (objectiveFilter === ALL ? pastCampaigns : pastCampaigns.filter((c) => c.objective === objectiveFilter)),
    [pastCampaigns, objectiveFilter],
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
          Connect a Meta ad account in Settings to see your campaigns.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <FilterPill label="All objectives" active={objectiveFilter === ALL} onClick={() => setObjectiveFilter(ALL)} />
          {objectives.map((obj) => (
            <FilterPill
              key={obj}
              label={OBJECTIVE_LABELS[obj] ?? obj}
              active={objectiveFilter === obj}
              activeClass={OBJECTIVE_BADGE[obj]}
              onClick={() => setObjectiveFilter(obj)}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="last_7d">Last 7 days</option>
            <option value="last_30d">Last 30 days</option>
            <option value="last_90d">Last 90 days</option>
            <option value="last_year">Last year</option>
            <option value="maximum">All time</option>
          </select>
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* Live campaigns */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-emerald-500" />
            Live now
            {filteredLive.length > 0 ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px]">
                {filteredLive.length} active
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>Campaigns currently spending on your Meta account.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && liveCampaigns.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLive.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/10 p-6 text-center text-sm text-muted-foreground">
              <Activity className="mx-auto mb-2 h-5 w-5 text-muted-foreground/40" />
              No active campaigns. Activate an ad from the Ad Library to see it here.
            </div>
          ) : (
            <div className="divide-y rounded-xl border">
              {filteredLive.map((c) => (
                <CampaignRow
                  key={c.id}
                  campaign={c}
                  adsManagerUrl={adsManagerUrl(c)}
                  loading={loading}
                  onTerminate={() => void handleTerminate(c)}
                  terminating={terminatingId === c.id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past campaigns */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Ad history
                {pastCampaigns.length > 0 ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {pastCampaigns.length} campaigns
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription>All paused, completed, and archived campaigns from your account.</CardDescription>
            </div>
            {pastCampaigns.length > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => setShowPast((v) => !v)}>
                {showPast ? <ChevronUp className="mr-1.5 h-4 w-4" /> : <ChevronDown className="mr-1.5 h-4 w-4" />}
                {showPast ? 'Collapse' : 'Show all'}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {loading && pastCampaigns.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPast.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/10 p-6 text-center text-sm text-muted-foreground">
              No past campaigns found.
            </div>
          ) : (
            <div className="divide-y rounded-xl border">
              {(showPast ? filteredPast : filteredPast.slice(0, 5)).map((c) => (
                <CampaignRow key={c.id} campaign={c} adsManagerUrl={adsManagerUrl(c)} loading={loading} />
              ))}
              {!showPast && filteredPast.length > 5 ? (
                <button
                  type="button"
                  onClick={() => setShowPast(true)}
                  className="w-full px-4 py-3 text-center text-sm text-primary hover:bg-muted/30"
                >
                  Show {filteredPast.length - 5} more campaigns
                </button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CampaignRow({
  campaign: c,
  adsManagerUrl,
  loading,
  onTerminate,
  terminating = false,
}: {
  campaign: Campaign
  adsManagerUrl: string
  loading: boolean
  onTerminate?: () => void
  terminating?: boolean
}) {
  const objLabel = OBJECTIVE_LABELS[c.objective] ?? c.objective ?? 'Unknown'
  const objBadge = OBJECTIVE_BADGE[c.objective] ?? 'bg-muted text-muted-foreground'
  const statusPill = STATUS_PILL[c.effective_status] ?? 'bg-muted text-muted-foreground'
  const ins = c.insights

  const budget = c.daily_budget
    ? `$${(Number(c.daily_budget) / 100).toFixed(2)}/day`
    : c.lifetime_budget
    ? `$${(Number(c.lifetime_budget) / 100).toFixed(2)} lifetime`
    : null

  const leadsValue = extractLeads(ins)

  return (
    <div className="flex flex-col gap-3 px-4 py-3 first:rounded-t-xl last:rounded-b-xl sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate font-medium leading-tight">{c.name}</p>
          <Badge variant="secondary" className={cn('shrink-0 text-[10px]', objBadge)}>
            {objLabel}
          </Badge>
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize', statusPill)}>
            {c.effective_status === 'ACTIVE' ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
            {(c.effective_status ?? '').toLowerCase()}
          </span>
        </div>
        {budget ? <p className="mt-0.5 text-xs text-muted-foreground">{budget}</p> : null}
      </div>

      <div className="flex shrink-0 flex-wrap gap-4 text-right sm:gap-5">
        <MetricCell label="Spend" value={ins?.spend ? `$${Number(ins.spend).toFixed(2)}` : loading ? '...' : '-'} />
        <MetricCell label="Reach" value={ins?.reach ? Number(ins.reach).toLocaleString() : loading ? '...' : '-'} />
        <MetricCell label="Clicks" value={ins?.clicks ? Number(ins.clicks).toLocaleString() : loading ? '...' : '-'} />
        <MetricCell label="CTR" value={ins?.ctr ? `${Number(ins.ctr).toFixed(2)}%` : loading ? '...' : '-'} />
        {leadsValue !== null ? (
          <MetricCell label="Leads" value={leadsValue} highlight />
        ) : ins?.spend && Number(ins.spend) > 0 && c.objective === 'OUTCOME_SALES' ? (
          <MetricCell label="ROAS" value="-" />
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {onTerminate ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onTerminate}
            disabled={terminating}
            title="Turn off this campaign on Meta"
            className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {terminating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
            <span className="ml-1.5 hidden sm:inline">{terminating ? 'Turning off…' : 'Turn off'}</span>
          </Button>
        ) : null}
        <a
          href={adsManagerUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in Ads Manager"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
        >
          <ExternalLink className="h-4 w-4 text-[#1877F2]" />
        </a>
      </div>
    </div>
  )
}

function MetricCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="min-w-[48px]">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn('font-semibold tabular-nums', highlight && 'text-emerald-600 dark:text-emerald-400')}>{value}</p>
    </div>
  )
}

function FilterPill({
  label,
  active,
  onClick,
  activeClass,
}: {
  label: string
  active: boolean
  onClick: () => void
  activeClass?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active ? cn('border-transparent', activeClass || 'bg-primary/10 text-primary') : 'hover:bg-muted',
      )}
    >
      {label}
    </button>
  )
}
