import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, RefreshCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type CampaignRow = {
  id: string
  name?: string
  status?: string
  objective?: string
  created_time?: string
  updated_time?: string
}

type AdRow = {
  id: string
  name?: string
  status?: string
  campaign_id?: string
  creative?: {
    thumbnail_url?: string
    object_story_spec?: unknown
  } | null
}

type InsightRow = {
  impressions?: string
  clicks?: string
  spend?: string
  ctr?: string
  cpc?: string
  roas?: string
}

type CampaignWithInsights = CampaignRow & {
  insights?: InsightRow | null
  previewUrl?: string | null
  source?: 'meta' | 'local'
  destination?: string | null
}

type LocalAdRow = {
  id: string
  title: string
  description: string | null
  status: string
  scheduled_at: string
  created_at: string | null
  updated_at: string | null
  platform: string | null
  external_id: string | null
  external_source: string | null
  link_url: string | null
  payload: Record<string, unknown> | null
}

export function PublishedAdsPanel({
  workspaceId,
  metaAccountId,
}: {
  workspaceId: string | null
  metaAccountId: string | null
}) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [campaigns, setCampaigns] = useState<CampaignWithInsights[]>([])
  const [localAds, setLocalAds] = useState<CampaignWithInsights[]>([])

  const combined = useMemo(() => {
    const seen = new Set<string>()
    const merged: CampaignWithInsights[] = []
    for (const item of [...campaigns, ...localAds]) {
      const key = item.id
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(item)
    }
    return merged
  }, [campaigns, localAds])

  const currentAndPast = useMemo(() => {
    const now = Date.now()
    const current: CampaignWithInsights[] = []
    const past: CampaignWithInsights[] = []
    combined.forEach((c) => {
      const ts = c.updated_time
        ? new Date(c.updated_time).getTime()
        : c.created_time
        ? new Date(c.created_time).getTime()
        : 0
      const isRecent = ts > 0 && now - ts < 60 * 24 * 60 * 60 * 1000 // ~60 days
      ;(isRecent ? current : past).push(c)
    })
    return { current, past }
  }, [combined])

  const loadLocalHistory = useCallback(async (): Promise<CampaignWithInsights[]> => {
    if (!workspaceId) return []
    const { data, error } = await supabase
      .from('planner_tasks')
      .select('id, title, description, status, scheduled_at, created_at, updated_at, platform, external_id, external_source, link_url, payload')
      .eq('workspace_id', workspaceId)
      .eq('kind', 'ad')
      .order('updated_at', { ascending: false })
      .limit(100)
    if (error) {
      console.warn('[PublishedAdsPanel] local history load failed', error)
      return []
    }
    const rows = (data ?? []) as LocalAdRow[]
    return rows.map((row) => {
      const payload = (row.payload ?? {}) as Record<string, unknown>
      const previewUrl =
        (payload.preview_url as string | undefined) ||
        (payload.thumbnail_url as string | undefined) ||
        (Array.isArray(payload.media_urls) ? (payload.media_urls[0] as string | undefined) : undefined) ||
        null
      const objective =
        (payload.objective as string | undefined) ||
        (payload.goal as string | undefined) ||
        (row.platform === 'meta' ? 'Meta Ad' : row.platform ?? 'Ad')
      return {
        id: row.external_id || `local-${row.id}`,
        name: row.title || (payload.campaign_name as string | undefined) || 'Untitled campaign',
        status: row.status?.toUpperCase() ?? 'DRAFT',
        objective,
        created_time: row.created_at ?? row.scheduled_at,
        updated_time: row.updated_at ?? row.scheduled_at,
        insights: null,
        previewUrl,
        source: 'local',
        destination: row.link_url ?? null,
      } satisfies CampaignWithInsights
    })
  }, [workspaceId])

  const refresh = useCallback(async () => {
    setLoading(true)
    setMessage('')

    // Always load local history; it doesn’t depend on Meta API connectivity.
    const local = await loadLocalHistory()
    setLocalAds(local)

    if (!metaAccountId) {
      setCampaigns([])
      setLoading(false)
      if (local.length === 0) {
        setMessage('Connect a Meta ad account in Settings → Connections to see live campaigns here.')
      }
      return
    }

    try {
      const { data: list, error: listError } = await supabase.functions.invoke('meta-ads', {
        body: {
          action: 'list_campaigns',
          workspace_id: workspaceId,
          account_id: metaAccountId,
        },
      })
      if (listError) throw new Error(listError.message)
      const rows = (list?.data as CampaignRow[]) ?? []
      const top = rows.slice(0, 12)

      // Fetch ads to get creative thumbnails (true previews).
      const { data: adsRes, error: adsErr } = await supabase.functions.invoke('meta-ads', {
        body: { action: 'list_ads', workspace_id: workspaceId, account_id: metaAccountId },
      })
      if (adsErr) throw new Error(adsErr.message)
      const ads = ((adsRes as { data?: AdRow[] } | null)?.data ?? []) as AdRow[]
      const previewByCampaign: Record<string, string> = {}
      for (const ad of ads) {
        const thumb = ad.creative?.thumbnail_url
        if (thumb && ad.campaign_id && !previewByCampaign[ad.campaign_id]) {
          previewByCampaign[ad.campaign_id] = thumb
        }
      }

      const withInsights: CampaignWithInsights[] = []
      for (const campaign of top) {
        const { data: ins, error: insErr } = await supabase.functions.invoke('meta-ads', {
          body: { action: 'insights', workspace_id: workspaceId, campaign_id: campaign.id },
        })
        if (insErr) {
          withInsights.push({
            ...campaign,
            insights: null,
            previewUrl: previewByCampaign[campaign.id] ?? null,
            source: 'meta',
          })
          continue
        }
        const insight = Array.isArray(ins?.data) ? (ins.data[0] as InsightRow | undefined) : undefined
        withInsights.push({
          ...campaign,
          insights: insight ?? null,
          previewUrl: previewByCampaign[campaign.id] ?? null,
          source: 'meta',
        })
      }

      setCampaigns(withInsights)
      if (rows.length === 0 && local.length === 0) {
        setMessage('No campaigns found yet. Publish your first campaign to see metrics here.')
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : ''
      const friendly = raw.toLowerCase().includes('failed to send')
        ? 'Could not reach Meta Ads. Showing your past ads from this workspace. Check Settings → Connections to refresh your Meta link.'
        : raw || 'Could not load live Meta campaign metrics. Showing past ads from this workspace.'
      setMessage(friendly)
      setCampaigns([])
    } finally {
      setLoading(false)
    }
  }, [loadLocalHistory, metaAccountId, workspaceId])

  useEffect(() => {
    if (workspaceId) void refresh()
  }, [workspaceId, metaAccountId, refresh])

  const totalCount = combined.length

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            Published ads
            {totalCount > 0 ? (
              <Badge variant="secondary" className="text-[10px]">
                {totalCount} total
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>Current and past Meta campaigns with key metrics, including your full ad history.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
          <RefreshCcw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? <div className="rounded-xl border bg-primary/5 px-4 py-3 text-sm">{message}</div> : null}

        {combined.length > 0 ? (
          <div className="space-y-5">
            <Section title="Current / recent (last 60 days)" items={currentAndPast.current} />
            <Section title="Past history" items={currentAndPast.past} />
          </div>
        ) : (
          !loading ? (
            <div className="rounded-xl border border-dashed bg-muted/10 p-6 text-center text-sm text-muted-foreground">
              <Archive className="mx-auto mb-2 h-5 w-5 text-muted-foreground/60" />
              No campaign data yet.
            </div>
          ) : null
        )}
      </CardContent>
    </Card>
  )
}

function Section({ title, items }: { title: string; items: CampaignWithInsights[] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((c) => (
          <div key={c.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{c.name || 'Campaign'}</p>
                  {c.source === 'local' ? (
                    <Badge variant="outline" className="shrink-0 text-[9px]">
                      Local
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.objective || 'Objective'} · {c.status || 'status'}
                </p>
              </div>
              <Badge variant={c.status === 'ACTIVE' ? 'default' : 'secondary'} className="shrink-0">
                {c.status || '—'}
              </Badge>
            </div>

            {c.previewUrl ? (
              <div className="mt-3 overflow-hidden rounded-xl border bg-muted/20">
                <img src={c.previewUrl} alt="" className="h-40 w-full object-cover" />
              </div>
            ) : (
              <div className="mt-3 flex h-40 items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">
                No creative preview available
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Metric label="Spend" value={fmtMoney(c.insights?.spend)} />
              <Metric label="Impressions" value={fmtInt(c.insights?.impressions)} />
              <Metric label="Clicks" value={fmtInt(c.insights?.clicks)} />
              <Metric label="CTR" value={fmtPct(c.insights?.ctr)} />
              <Metric label="CPC" value={fmtMoney(c.insights?.cpc)} />
              <Metric label="ROAS" value={fmtNum(c.insights?.roas)} />
            </div>

            {!c.insights ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {c.source === 'local'
                  ? 'Metrics will appear once Meta Ads insights sync for this campaign.'
                  : 'Metrics unavailable (check permissions or campaign has no delivery yet).'}
              </p>
            ) : null}

            {c.destination ? (
              <p className="mt-2 truncate text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Destination:</span> {c.destination}
              </p>
            ) : null}

            <p className="mt-2 text-[11px] text-muted-foreground">
              {c.updated_time
                ? `Updated ${new Date(c.updated_time).toLocaleDateString()}`
                : c.created_time
                ? `Created ${new Date(c.created_time).toLocaleDateString()}`
                : null}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 px-2.5 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  )
}

function fmtInt(value: string | undefined) {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString()
}

function fmtMoney(value: string | undefined) {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return '—'
  return `$${n.toFixed(2)}`
}

function fmtPct(value: string | undefined) {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return '—'
  return `${n.toFixed(2)}%`
}

function fmtNum(value: string | undefined) {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(2)
}
