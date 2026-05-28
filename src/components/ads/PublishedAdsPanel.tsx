import { useEffect, useMemo, useState } from 'react'
import { RefreshCcw } from 'lucide-react'
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

type CampaignWithInsights = CampaignRow & { insights?: InsightRow | null; previewUrl?: string | null }

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

  const canLoad = Boolean(workspaceId && metaAccountId)

  const currentAndPast = useMemo(() => {
    const now = Date.now()
    const current: CampaignWithInsights[] = []
    const past: CampaignWithInsights[] = []
    campaigns.forEach((c) => {
      const ts = c.updated_time ? new Date(c.updated_time).getTime() : c.created_time ? new Date(c.created_time).getTime() : 0
      const isRecent = ts > 0 && now - ts < 60 * 24 * 60 * 60 * 1000 // ~60 days
      ;(isRecent ? current : past).push(c)
    })
    return { current, past }
  }, [campaigns])

  const refresh = async () => {
    if (!workspaceId || !metaAccountId) return
    setLoading(true)
    setMessage('')
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
          withInsights.push({ ...campaign, insights: null, previewUrl: previewByCampaign[campaign.id] ?? null })
          continue
        }
        const insight = Array.isArray(ins?.data) ? (ins.data[0] as InsightRow | undefined) : undefined
        withInsights.push({ ...campaign, insights: insight ?? null, previewUrl: previewByCampaign[campaign.id] ?? null })
      }

      setCampaigns(withInsights)
      if (rows.length === 0) setMessage('No campaigns found yet. Publish your first campaign to see metrics here.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not load Meta campaign metrics.')
      setCampaigns([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canLoad) void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad])

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Published ads</CardTitle>
          <CardDescription>Current and past Meta campaigns with key metrics.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={!canLoad || loading}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canLoad ? (
          <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
            Connect your Meta ad account to load published campaigns and performance metrics.
          </div>
        ) : null}

        {message ? <div className="rounded-xl border bg-primary/5 px-4 py-3 text-sm">{message}</div> : null}

        {campaigns.length > 0 ? (
          <div className="space-y-5">
            <Section title="Current / recent" items={currentAndPast.current} />
            <Section title="Past" items={currentAndPast.past} />
          </div>
        ) : (
          canLoad && !loading ? <p className="text-sm text-muted-foreground">No campaign data yet.</p> : null
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
                <p className="truncate text-sm font-semibold">{c.name || 'Campaign'}</p>
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
                No creative preview available yet
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
              <p className={cn('mt-3 text-xs text-muted-foreground')}>
                Metrics unavailable (check permissions or campaign has no delivery yet).
              </p>
            ) : null}
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

