import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, Calendar, ExternalLink, Loader2, RefreshCcw, Search, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { useConfirm } from '@/components/ConfirmProvider'
import { FacebookAdPreview } from '@/components/ads/FacebookAdPreview'
import {
  AD_CREATIVE_STATUS_LABELS,
  deleteAdCreative,
  listAdCreatives,
  updateAdCreative,
  type AdCreative,
  type AdCreativeStatus,
} from '@/lib/ads-creatives'
import { cn } from '@/lib/utils'

const AD_LIBRARY_PAGE_SIZE = 9

const STATUS_FILTERS: Array<{ value: AdCreativeStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'ai_draft', label: 'AI drafts' },
  { value: 'draft', label: 'Drafts' },
  { value: 'published', label: 'Published' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
]

const STATUS_BADGE_CLASS: Record<AdCreativeStatus, string> = {
  ai_draft: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  draft: 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  published: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  paused: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  completed: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  archived: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
}

type AdLibraryPanelProps = {
  workspaceId: string | null
  businessName: string
  facebookPageId?: string | null
  onOpenInStudio?: (creative: AdCreative) => void
}

export function AdLibraryPanel({
  workspaceId,
  businessName,
  facebookPageId = null,
  onOpenInStudio,
}: AdLibraryPanelProps) {
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [items, setItems] = useState<AdCreative[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<AdCreativeStatus | 'all'>('all')
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const refresh = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    setError(null)
    try {
      const rows = await listAdCreatives({ workspaceId, status, search })
      setItems(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ad library')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, status, search])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Clamp the requested page during render rather than via setState in an
  // effect, so list shrinks (deletes, status filter changes that reduce the
  // result count) never leave us on an empty page and we don't trigger
  // cascading renders. We DO still reset to page 1 on filter changes via
  // setPage from the click handlers (see status / search inputs below).
  const safePage = Math.min(
    Math.max(1, page),
    Math.max(1, Math.ceil(items.length / AD_LIBRARY_PAGE_SIZE)),
  )

  const visibleItems = useMemo(
    () => items.slice((safePage - 1) * AD_LIBRARY_PAGE_SIZE, safePage * AD_LIBRARY_PAGE_SIZE),
    [items, safePage],
  )

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = { all: items.length }
    for (const it of items) {
      byStatus[it.status] = (byStatus[it.status] ?? 0) + 1
    }
    return byStatus
  }, [items])

  const handleArchive = async (creative: AdCreative) => {
    const ok = await confirm({
      title: 'Archive this ad?',
      description: 'It will be hidden from the active library. You can restore it later.',
      confirmLabel: 'Archive',
    })
    if (!ok) return
    try {
      await updateAdCreative(creative.id, { status: 'archived' })
      void refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive ad')
    }
  }

  const handleDelete = async (creative: AdCreative) => {
    const ok = await confirm({
      title: 'Delete this ad?',
      description: 'This permanently removes the creative. This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    })
    if (!ok) return
    try {
      await deleteAdCreative(creative.id)
      void refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete ad')
    }
  }

  const handleStatusChange = async (creative: AdCreative, next: AdCreativeStatus) => {
    try {
      await updateAdCreative(creative.id, { status: next })
      void refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Ad Library</CardTitle>
          <CardDescription>
            Every variant you've generated or saved. Filter, edit, archive, or send back into the studio.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate('/app/ads/history')}>
            <Calendar className="mr-2 h-4 w-4" />
            View timeline
          </Button>
          <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading || !workspaceId}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search headlines, primary text, campaigns…"
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => {
            const c = counts[f.value] ?? 0
            const active = status === f.value
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  setStatus(f.value)
                  setPage(1)
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  active ? 'border-[#1877F2] bg-[#1877F2]/10 text-[#1877F2]' : 'hover:bg-muted',
                )}
              >
                {f.label}
                <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{c}</span>
              </button>
            )
          })}
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!workspaceId ? (
          <EmptyState message="Pick a workspace to load its ad library." />
        ) : items.length === 0 && !loading ? (
          <EmptyState message="No ads yet. Generate your first campaign in the Studio." />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleItems.map((creative) => (
                <AdLibraryCard
                  key={creative.id}
                  creative={creative}
                  businessName={businessName}
                  facebookPageId={facebookPageId}
                  onArchive={() => void handleArchive(creative)}
                  onDelete={() => void handleDelete(creative)}
                  onStatusChange={(next) => void handleStatusChange(creative, next)}
                  onOpen={onOpenInStudio ? () => onOpenInStudio(creative) : undefined}
                  onOpenDetail={() => navigate(`/app/ads/library/${creative.id}`)}
                />
              ))}
            </div>

            <Pagination
              totalItems={items.length}
              pageSize={AD_LIBRARY_PAGE_SIZE}
              page={safePage}
              onPageChange={setPage}
              itemLabel="ads"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/10 p-8 text-center text-sm text-muted-foreground">
      <Archive className="mx-auto mb-2 h-5 w-5 text-muted-foreground/60" />
      {message}
    </div>
  )
}

function AdLibraryCard({
  creative,
  businessName,
  facebookPageId,
  onArchive,
  onDelete,
  onStatusChange,
  onOpen,
  onOpenDetail,
}: {
  creative: AdCreative
  businessName: string
  facebookPageId?: string | null
  onArchive: () => void
  onDelete: () => void
  onStatusChange: (next: AdCreativeStatus) => void
  onOpen?: () => void
  onOpenDetail?: () => void
}) {
  const pageAvatarUrl = facebookPageId
    ? `https://graph.facebook.com/${encodeURIComponent(facebookPageId)}/picture?type=large`
    : null
  const destinationDomain = useMemo(() => {
    if (!creative.destination_url) return ''
    try {
      return new URL(creative.destination_url).hostname.replace(/^www\./, '')
    } catch {
      return creative.destination_url.replace(/^https?:\/\//, '').split('/')[0]
    }
  }, [creative.destination_url])

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {creative.campaign_name || creative.headline || 'Untitled ad'}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {creative.variant_label}
            {creative.angle ? ` · ${creative.angle.replace(/-/g, ' ')}` : ''}
          </p>
        </div>
        <Badge variant="outline" className={cn('shrink-0', STATUS_BADGE_CLASS[creative.status])}>
          {AD_CREATIVE_STATUS_LABELS[creative.status]}
        </Badge>
      </div>

      <FacebookAdPreview
        data={{
          pageName: businessName || 'Your Page',
          pageAvatarUrl,
          primaryText: creative.primary_text,
          headline: creative.headline,
          description: creative.description ?? undefined,
          cta: creative.cta,
          mediaUrl: creative.media_url,
          mediaType: (creative.media_type as 'image' | 'video' | undefined) ?? 'image',
          destinationDomain,
        }}
        placement="facebook-feed"
        device="mobile"
      />

      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
        <div>
          <span className="text-foreground">Goal:</span> {creative.goal || '—'}
        </div>
        <div>
          <span className="text-foreground">Budget:</span>{' '}
          {creative.budget?.type === 'lifetime'
            ? `$${creative.budget?.lifetime ?? '—'} lifetime`
            : `$${creative.budget?.daily ?? '—'}/day`}
        </div>
        <div className="col-span-2 truncate">
          <span className="text-foreground">Audience:</span>{' '}
          {creative.audience?.location || '—'}
          {creative.audience?.age_min ? ` · ${creative.audience.age_min}-${creative.audience.age_max ?? '+'}` : ''}
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        {onOpenDetail ? (
          <Button size="sm" variant="default" className="flex-1" onClick={onOpenDetail}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Open detail
          </Button>
        ) : null}
        {onOpen ? (
          <Button size="sm" variant="outline" onClick={onOpen}>
            Edit
          </Button>
        ) : null}
        <StatusMenu current={creative.status} onChange={onStatusChange} />
        <Button size="icon" variant="ghost" onClick={onArchive} title="Archive">
          <Archive className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onDelete} title="Delete">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Updated {new Date(creative.updated_at).toLocaleString()}
      </p>
    </div>
  )
}

function StatusMenu({
  current,
  onChange,
}: {
  current: AdCreativeStatus
  onChange: (next: AdCreativeStatus) => void
}) {
  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value as AdCreativeStatus)}
      className="h-8 rounded-md border bg-background px-2 text-xs"
    >
      {(Object.keys(AD_CREATIVE_STATUS_LABELS) as AdCreativeStatus[]).map((status) => (
        <option key={status} value={status}>
          {AD_CREATIVE_STATUS_LABELS[status]}
        </option>
      ))}
    </select>
  )
}
