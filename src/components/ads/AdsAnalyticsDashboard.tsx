import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, Loader2, RefreshCcw, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  DATE_RANGE_OPTIONS,
  fmtCurrency,
  fmtNumber,
  fmtPercent,
  fmtRatio,
  loadAdAnalytics,
  loadAggregatedTrends,
  sumMetrics,
  type AdMetrics,
  type AnalyticsRow,
  type DateRangePreset,
  type TrendPoint,
} from '@/lib/ads-analytics'
import { Sparkline } from '@/components/ads/Sparkline'
import { AD_CREATIVE_STATUS_LABELS, type AdCreativeStatus } from '@/lib/ads-creatives'
import { cn } from '@/lib/utils'

type AdsAnalyticsDashboardProps = {
  workspaceId: string | null
  /** When set, analytics are scoped to this Facebook Page. */
  facebookPageId?: string | null
}

const STATUS_FILTERS: Array<{ value: AdCreativeStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'draft', label: 'Drafts' },
  { value: 'ai_draft', label: 'AI drafts' },
  { value: 'archived', label: 'Archived' },
]

type SortKey =
  | 'name'
  | 'status'
  | 'spend'
  | 'reach'
  | 'impressions'
  | 'ctr'
  | 'cpc'
  | 'cpm'
  | 'frequency'
  | 'leads'
  | 'conversions'
  | 'roas'

const COLUMNS: Array<{ key: SortKey; label: string; numeric?: boolean; metric?: keyof AdMetrics; format?: (n: number) => string }> = [
  { key: 'name', label: 'Ad' },
  { key: 'status', label: 'Status' },
  { key: 'spend', label: 'Spend', numeric: true, metric: 'spend', format: (n) => fmtCurrency(n) },
  { key: 'reach', label: 'Reach', numeric: true, metric: 'reach', format: fmtNumber },
  { key: 'impressions', label: 'Impr.', numeric: true, metric: 'impressions', format: fmtNumber },
  { key: 'ctr', label: 'CTR', numeric: true, metric: 'ctr', format: fmtPercent },
  { key: 'cpc', label: 'CPC', numeric: true, metric: 'cpc', format: (n) => fmtCurrency(n) },
  { key: 'cpm', label: 'CPM', numeric: true, metric: 'cpm', format: (n) => fmtCurrency(n) },
  { key: 'frequency', label: 'Freq.', numeric: true, metric: 'frequency', format: (n) => (n ? n.toFixed(2) : '—') },
  { key: 'leads', label: 'Leads', numeric: true, metric: 'leads', format: fmtNumber },
  { key: 'conversions', label: 'Conv.', numeric: true, metric: 'conversions', format: fmtNumber },
  { key: 'roas', label: 'ROAS', numeric: true, metric: 'roas', format: fmtRatio },
]

export function AdsAnalyticsDashboard({ workspaceId, facebookPageId = null }: AdsAnalyticsDashboardProps) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<AnalyticsRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preset, setPreset] = useState<DateRangePreset>('last_30d')
  const [status, setStatus] = useState<AdCreativeStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('spend')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [trends, setTrends] = useState<TrendPoint[]>([])

  const refresh = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    setError(null)
    try {
      const data = await loadAdAnalytics({ workspaceId, preset, facebookPageId })
      setRows(data)
      const aggregated = await loadAggregatedTrends({
        workspaceId,
        creatives: data.map((r) => r.creative),
        preset,
      })
      setTrends(aggregated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, preset, facebookPageId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (status !== 'all' && row.creative.status !== status) return false
      if (search) {
        const needle = search.toLowerCase()
        const hay = [
          row.creative.campaign_name,
          row.creative.headline,
          row.creative.primary_text,
          row.creative.variant_label,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [rows, status, search])

  const sorted = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      let av: number | string = 0
      let bv: number | string = 0
      if (sortKey === 'name') {
        av = a.creative.campaign_name || a.creative.headline || ''
        bv = b.creative.campaign_name || b.creative.headline || ''
      } else if (sortKey === 'status') {
        av = a.creative.status
        bv = b.creative.status
      } else {
        av = a.metrics[sortKey as keyof AdMetrics] as number
        bv = b.metrics[sortKey as keyof AdMetrics] as number
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av)
    })
    return list
  }, [filtered, sortKey, sortDir])

  const totals = useMemo(() => sumMetrics(filtered.map((row) => row.metrics)), [filtered])
  const linkedCount = rows.filter((r) => !r.metricsUnavailable).length

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Analytics
              <Badge variant="secondary" className="text-[10px] font-normal">
                {rows.length} live {rows.length === 1 ? 'ad' : 'ads'}
              </Badge>
            </CardTitle>
            <CardDescription>
              Live Meta performance for every ad published from this Page: spend, reach, impressions, CTR, CPC, CPM, frequency, leads, conversions and ROAS.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading || !workspaceId}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            <KpiCard label="Spend" value={fmtCurrency(totals.spend)} accent="text-[#1877F2]" trend={trends.map((t) => t.spend)} />
            <KpiCard label="Reach" value={fmtNumber(totals.reach)} trend={trends.map((t) => t.reach)} />
            <KpiCard label="Impressions" value={fmtNumber(totals.impressions)} trend={trends.map((t) => t.impressions)} />
            <KpiCard label="Clicks" value={fmtNumber(totals.clicks)} trend={trends.map((t) => t.clicks)} />
            <KpiCard label="CTR" value={fmtPercent(totals.ctr)} trend={trends.map((t) => t.ctr)} />
            <KpiCard label="CPC" value={fmtCurrency(totals.cpc)} trend={trends.map((t) => t.cpc)} />
            <KpiCard label="CPM" value={fmtCurrency(totals.cpm)} trend={trends.map((t) => t.cpm)} />
            <KpiCard label="Freq." value={totals.frequency ? totals.frequency.toFixed(2) : '—'} />
            <KpiCard label="Leads" value={fmtNumber(totals.leads)} trend={trends.map((t) => t.leads)} />
            <KpiCard label="Conversions" value={fmtNumber(totals.conversions)} trend={trends.map((t) => t.conversions)} />
            <KpiCard label="Purchases" value={fmtNumber(totals.purchases)} />
            <KpiCard label="ROAS" value={fmtRatio(totals.roas)} accent="text-emerald-600" />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ads…"
              className="sm:max-w-xs"
            />
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatus(f.value)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    status === f.value ? 'border-[#1877F2] bg-[#1877F2]/10 text-[#1877F2]' : 'hover:bg-muted',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {!workspaceId ? (
            <EmptyHint message="Pick a workspace to load analytics." />
          ) : sorted.length === 0 && !loading ? (
            <EmptyHint message="No live ads for this Page yet. Publish an ad to Meta and its real performance will appear here." />
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className={cn(
                          'px-3 py-2 text-left font-medium',
                          col.numeric ? 'text-right' : '',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => handleSort(col.key)}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          {col.label}
                          {sortKey === col.key ? (
                            sortDir === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-50" />
                          )}
                        </button>
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(({ creative, metrics, metricsUnavailable }) => (
                    <tr key={creative.id} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {creative.media_url ? (
                            creative.media_type === 'video' ? (
                              <video src={creative.media_url} className="h-10 w-10 rounded object-cover" muted playsInline />
                            ) : (
                              <img src={creative.media_url} alt="" className="h-10 w-10 rounded object-cover" />
                            )
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {creative.campaign_name || creative.headline || 'Untitled'}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {creative.variant_label}
                              {metricsUnavailable ? ' · not on Meta yet' : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px]">
                          {AD_CREATIVE_STATUS_LABELS[creative.status]}
                        </Badge>
                      </td>
                      {COLUMNS.filter((c) => c.numeric).map((col) => {
                        const raw = col.metric ? (metrics[col.metric] as number) : 0
                        return (
                          <td key={col.key} className="px-3 py-2 text-right tabular-nums">
                            {col.format ? col.format(raw) : raw}
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/app/ads/library/${creative.id}`)}
                          className="h-8"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rows.length > linkedCount ? (
            <div className="flex items-start gap-2 rounded-xl border border-[#1877F2]/30 bg-[#1877F2]/5 px-3 py-2 text-xs">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-[#1877F2]" />
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">{rows.length - linkedCount}</span> of your ads aren't on Meta yet.
                Publish them from the Studio to start collecting real performance metrics.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({
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

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/10 p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
