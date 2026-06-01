import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowLeft, Calendar, ExternalLink, Loader2, RefreshCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  AD_CREATIVE_STATUS_LABELS,
  listAdCreatives,
  type AdCreative,
  type AdCreativeStatus,
} from '@/lib/ads-creatives'
import { cn } from '@/lib/utils'

interface OutletContext {
  currentWorkspaceId: string | null
}

const STATUS_FILTERS: Array<{ value: AdCreativeStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
  { value: 'draft', label: 'Drafts' },
  { value: 'ai_draft', label: 'AI drafts' },
]

const STATUS_DOT: Record<AdCreativeStatus, string> = {
  ai_draft: 'bg-amber-500',
  draft: 'bg-slate-500',
  published: 'bg-emerald-500',
  paused: 'bg-orange-500',
  completed: 'bg-sky-500',
  archived: 'bg-zinc-500',
}

type CampaignGroup = {
  campaignName: string
  earliest: string
  latest: string
  items: AdCreative[]
}

type MonthBucket = {
  key: string // YYYY-MM
  label: string
  campaigns: CampaignGroup[]
}

function formatMonthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-')
  if (!y || !m) return yyyyMm
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function AdHistoryPage() {
  const { currentWorkspaceId } = useOutletContext<OutletContext>()
  const navigate = useNavigate()
  const [items, setItems] = useState<AdCreative[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<AdCreativeStatus | 'all'>('all')
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!currentWorkspaceId) return
    setLoading(true)
    setError(null)
    try {
      const rows = await listAdCreatives({ workspaceId: currentWorkspaceId, status: 'all', limit: 500 })
      setItems(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [currentWorkspaceId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filtered = useMemo(() => {
    const lower = search.trim().toLowerCase()
    return items.filter((c) => {
      if (status !== 'all' && c.status !== status) return false
      if (!lower) return true
      const haystack = [c.campaign_name, c.headline, c.primary_text].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(lower)
    })
  }, [items, status, search])

  const buckets = useMemo<MonthBucket[]>(() => {
    const byMonth = new Map<string, Map<string, AdCreative[]>>()
    for (const c of filtered) {
      const baseDate = c.published_at || c.updated_at || c.created_at
      const date = baseDate ? new Date(baseDate) : new Date()
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const campaignKey = c.campaign_name || c.headline || 'Untitled'
      if (!byMonth.has(monthKey)) byMonth.set(monthKey, new Map())
      const campaignMap = byMonth.get(monthKey)!
      if (!campaignMap.has(campaignKey)) campaignMap.set(campaignKey, [])
      campaignMap.get(campaignKey)!.push(c)
    }
    const monthKeys = Array.from(byMonth.keys()).sort((a, b) => b.localeCompare(a))
    return monthKeys.map((key) => {
      const campaignMap = byMonth.get(key)!
      const campaigns: CampaignGroup[] = Array.from(campaignMap.entries()).map(([name, list]) => {
        const sorted = [...list].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
        return {
          campaignName: name,
          earliest: sorted[sorted.length - 1]?.created_at ?? sorted[sorted.length - 1]?.updated_at ?? '',
          latest: sorted[0]?.updated_at ?? '',
          items: sorted,
        }
      })
      campaigns.sort((a, b) => (b.latest || '').localeCompare(a.latest || ''))
      return { key, label: formatMonthLabel(key), campaigns }
    })
  }, [filtered])

  const totalsByStatus = useMemo(() => {
    const counts: Record<string, number> = { all: items.length }
    for (const c of items) counts[c.status] = (counts[c.status] ?? 0) + 1
    return counts
  }, [items])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate('/app/ads')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Ads
        </Button>
        <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading || !currentWorkspaceId}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Ad history
          </CardTitle>
          <CardDescription>
            A timeline of every ad created in this workspace, grouped by month and campaign.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns or headlines…"
              className="sm:max-w-xs"
            />
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((f) => {
                const count = totalsByStatus[f.value] ?? 0
                const active = status === f.value
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setStatus(f.value)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                      active ? 'border-[#1877F2] bg-[#1877F2]/10 text-[#1877F2]' : 'hover:bg-muted',
                    )}
                  >
                    {f.label}
                    <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {!currentWorkspaceId ? (
            <EmptyHint message="Pick a workspace to see its ad history." />
          ) : buckets.length === 0 && !loading ? (
            <EmptyHint message="No ads in this workspace match these filters yet." />
          ) : (
            <div className="space-y-6">
              {buckets.map((bucket) => (
                <section key={bucket.key} className="relative pl-6">
                  <div className="absolute left-2 top-2 h-3 w-3 rounded-full border-2 border-[#1877F2] bg-background" />
                  <div className="absolute left-3 top-5 bottom-0 w-px bg-border" />
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{bucket.label}</h3>
                    <span className="text-[11px] text-muted-foreground">
                      {bucket.campaigns.length} campaign{bucket.campaigns.length === 1 ? '' : 's'} · {bucket.campaigns.reduce((sum, g) => sum + g.items.length, 0)} ad{bucket.campaigns.reduce((sum, g) => sum + g.items.length, 0) === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {bucket.campaigns.map((group) => (
                      <div key={`${bucket.key}-${group.campaignName}`} className="rounded-xl border bg-card p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{group.campaignName}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {group.items.length} ad{group.items.length === 1 ? '' : 's'} ·
                              {' '}last activity {group.latest ? new Date(group.latest).toLocaleDateString() : ' - '}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {group.items.map((ad) => (
                            <button
                              key={ad.id}
                              type="button"
                              onClick={() => navigate(`/app/ads/library/${ad.id}`)}
                              className="group flex items-start gap-3 rounded-lg border bg-background p-2 text-left transition-colors hover:bg-muted/30"
                            >
                              {ad.media_url ? (
                                ad.media_type === 'video' ? (
                                  <video src={ad.media_url} className="h-14 w-14 shrink-0 rounded object-cover" muted playsInline />
                                ) : (
                                  <img src={ad.media_url} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
                                )
                              ) : (
                                <div className="h-14 w-14 shrink-0 rounded bg-muted" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[ad.status])} />
                                  <p className="text-[11px] text-muted-foreground">{AD_CREATIVE_STATUS_LABELS[ad.status]}</p>
                                </div>
                                <p className="mt-0.5 truncate text-sm font-medium">{ad.headline || 'Untitled'}</p>
                                <p className="line-clamp-2 text-[11px] text-muted-foreground">{ad.primary_text}</p>
                                <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                                  {ad.variant_label}
                                  {ad.meta_ad_id ? (
                                    <Badge variant="outline" className="text-[9px]">
                                      Meta
                                    </Badge>
                                  ) : null}
                                </p>
                              </div>
                              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/10 p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
