import { useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { usePlannerTasks } from '@/hooks/usePlannerTasks'
import { useWorkspaceIntegrations } from '@/hooks/useWorkspaceIntegrations'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { CalendarEvent, PlannerTask, AppOutletContext } from '@/types'
import { parseFacebookPages, parseInstagramAccounts } from '@/lib/meta-integration-options'
import {
  addDays,
  addHours,
  format,
  isSameDay,
  parseISO,
  setHours,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronLeft, ChevronRight, ExternalLink, Pencil } from 'lucide-react'
import { APP_PAGE } from '@/lib/app-labels'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/ConfirmProvider'
import { PlatformPostPreview, type PreviewPlatform } from '@/components/preview/PlatformPostPreview'

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6 AM - 11 PM
const GRID_START_HOUR = HOURS[0]
const GRID_END_HOUR = HOURS[HOURS.length - 1] + 1
const GRID_TOTAL_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60
/** ~55% taller than the previous ~28px flex-compressed rows */
const HOUR_SLOT_MIN_PX = 44
const CALENDAR_GRID_MIN_PX = HOURS.length * HOUR_SLOT_MIN_PX
const PLATFORM_COLORS: Record<string, string> = {
  facebook: '#1877F2',
  instagram: '#E1306C',
  linkedin: '#0A66C2',
  x: '#0F1419',
  meta_ads: '#F02849',
  google: '#EA4335',
}
const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  x: 'X',
  meta_ads: 'Meta Ads',
  google: 'Google',
}
const KIND_BADGES: Array<{ id: 'post' | 'ad' | 'event'; label: string; symbol: string; className: string }> = [
  { id: 'post', label: 'Post', symbol: '●', className: 'text-foreground' },
  { id: 'ad', label: 'Ad', symbol: '▲', className: 'text-foreground' },
  { id: 'event', label: 'Event', symbol: '◆', className: 'text-foreground' },
]

export function PlannerPage() {
  const { currentWorkspaceId, currentWorkspace, currentPageId } = useOutletContext<AppOutletContext>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { workspaces } = useWorkspaces(user?.id)

  // Local workspace/page filter - lets users browse any workspace/page without
  // changing their global selection. Defaults to the globally-active context.
  const [filterWorkspaceId, setFilterWorkspaceId] = useState<string | null>(null)
  const [filterPageId, setFilterPageId] = useState<string | null>(null)
  const [platformFilter, setPlatformFilter] = useState<string>('all')

  // Only Facebook/Instagram tasks carry a facebook_page_id, so the page-level
  // data filter only applies in those contexts.
  const isPageFilterablePlatform =
    platformFilter === 'all' || platformFilter === 'facebook' || platformFilter === 'instagram'

  const effectiveWorkspaceId = filterWorkspaceId ?? currentWorkspaceId
  const effectivePageId = isPageFilterablePlatform ? filterPageId ?? currentPageId : null

  const { tasks, createTask, updateTask, deleteTask, loading } = usePlannerTasks(
    effectiveWorkspaceId || undefined,
    effectivePageId,
  )
  const { integrations } = useWorkspaceIntegrations(effectiveWorkspaceId)

  // Pages / accounts available in this workspace for the dialog platform selector.
  const filterFbIntegration = useMemo(
    () => integrations.find((i) => i.provider === 'facebook' || i.provider === 'meta') ?? null,
    [integrations],
  )
  const filterPages = useMemo(() => parseFacebookPages(filterFbIntegration), [filterFbIntegration])
  const filterIgAccounts = useMemo(() => parseInstagramAccounts(filterFbIntegration), [filterFbIntegration])

  // Connected accounts for the currently-selected platform filter. Facebook /
  // Instagram drive real per-page data filtering; LinkedIn / X show their
  // connected profile so the user can see what's linked for that platform.
  const accountsForPlatform = useMemo<{ id: string; name: string }[]>(() => {
    switch (platformFilter) {
      case 'all':
      case 'facebook':
        return filterPages
      case 'instagram':
        return filterIgAccounts.map((a) => ({ id: a.id, name: `@${a.username}` }))
      case 'linkedin': {
        const li = integrations.find((i) => i.provider === 'linkedin')
        const profiles = li?.metadata?.profiles
        if (Array.isArray(profiles)) {
          return profiles
            .map((p) => {
              const rec = p as { id?: unknown; name?: unknown }
              const id = rec.id != null ? String(rec.id) : null
              return id ? { id, name: typeof rec.name === 'string' ? rec.name : id } : null
            })
            .filter((p): p is { id: string; name: string } => Boolean(p))
        }
        const name = li?.metadata?.linkedin_name
        const id = li?.metadata?.linkedin_id
        if (typeof name === 'string' && typeof id === 'string') return [{ id, name }]
        return []
      }
      case 'x': {
        const x = integrations.find((i) => i.provider === 'x')
        const handle = x?.metadata?.handle
        return typeof handle === 'string' ? [{ id: handle, name: `@${handle}` }] : []
      }
      default:
        return []
    }
  }, [platformFilter, filterPages, filterIgAccounts, integrations])

  // Label adapts to the platform (pages vs profiles).
  const accountFilterLabel = platformFilter === 'linkedin' || platformFilter === 'x' ? 'profile' : 'page'

  const [weekOffset, setWeekOffset] = useState(0)
  const [showDialog, setShowDialog] = useState(false)
  const [editingTask, setEditingTask] = useState<PlannerTask | null>(null)
  const [previewTask, setPreviewTask] = useState<PlannerTask | null>(null)
  const [plannerMessage, setPlannerMessage] = useState('')

  const today = new Date()
  const weekStart = startOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const events: CalendarEvent[] = useMemo(() => {
    return tasks.map((t) => {
      const start = parseISO(t.scheduled_at)
      return {
        id: t.id,
        title: t.title,
        start,
        end: addHours(start, Math.max(t.duration_minutes / 60, 0.5)),
        color: t.color || PLATFORM_COLORS[t.platform || ''] || '#1D9BF0',
        status: t.status,
        kind: t.kind,
        platform: t.platform || undefined,
        external: !!t.external_source,
      }
    })
  }, [tasks])

  // Accounts to offer in the filter: every connected account, plus any platform
  // already on the calendar (covers posts from a since-disconnected account).
  const availablePlatforms = useMemo(() => {
    const set = new Set<string>()
    for (const task of tasks) if (task.platform) set.add(task.platform)
    for (const integration of integrations) {
      switch (integration.provider) {
        case 'facebook':
        case 'meta': {
          set.add('facebook')
          const ig = integration.metadata?.instagram_accounts
          if (Array.isArray(ig) && ig.length > 0) set.add('instagram')
          break
        }
        case 'linkedin':
          set.add('linkedin')
          break
        case 'x':
          set.add('x')
          break
      }
    }
    // Keep a stable, sensible order.
    return ['facebook', 'instagram', 'linkedin', 'x', 'meta_ads', 'google'].filter((p) => set.has(p))
  }, [tasks, integrations])

  const visibleEvents = useMemo(
    () => (platformFilter === 'all' ? events : events.filter((event) => event.platform === platformFilter)),
    [events, platformFilter],
  )

  const openNewTask = (day?: Date, hour?: number) => {
    const base = day ? startOfDay(day) : startOfDay(today)
    const scheduled = hour !== undefined ? addHours(base, hour) : addHours(base, 9)
    setEditingTask({
      id: '',
      user_id: user?.id || '',
      workspace_id: currentWorkspaceId || '',
      title: '',
      description: '',
      scheduled_at: scheduled.toISOString(),
      duration_minutes: 60,
      status: 'draft',
      kind: 'post',
      platform: null,
      link_url: null,
      color: null,
      external_source: null,
      external_id: null,
      external_calendar_id: null,
      payload: null,
      facebook_page_id: null,
      created_at: '',
      updated_at: '',
    })
    setShowDialog(true)
  }

  const saveTask = async () => {
    if (!editingTask || !currentWorkspaceId) return
    if (!editingTask.title.trim()) return

    const payload = {
      ...editingTask,
      workspace_id: currentWorkspaceId,
    }

    try {
      if (editingTask.id) {
        await updateTask(editingTask.id, payload)
      } else {
        await createTask(payload)
      }
      setShowDialog(false)
      setEditingTask(null)
      setPlannerMessage('')
    } catch (error) {
      setPlannerMessage(error instanceof Error ? error.message : 'Could not save planner entry.')
    }
  }

  const removeTask = async () => {
    if (!editingTask?.id) return
    const confirmed = await confirm({
      title: 'Delete planner entry?',
      description: 'This removes the scheduled item from your content calendar.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    })
    if (!confirmed) return
    try {
      await deleteTask(editingTask.id)
      setShowDialog(false)
      setEditingTask(null)
      setPlannerMessage('')
    } catch (error) {
      setPlannerMessage(error instanceof Error ? error.message : 'Could not delete planner entry.')
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-1rem)] flex-col p-4">
      <header className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{APP_PAGE.contentCalendar}</h1>
          <p className="text-xs text-muted-foreground">
            {currentWorkspace?.name ?? 'Workspace'} schedule for social posts, ad launches, and imported Google events.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border bg-card px-2.5 py-1.5">
            <button type="button" onClick={() => setWeekOffset((o) => o - 1)} className="rounded-md p-1 hover:bg-accent">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium">
              {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </span>
            <button type="button" onClick={() => setWeekOffset((o) => o + 1)} className="rounded-md p-1 hover:bg-accent">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {/* Workspace filter */}
          {workspaces.length > 1 ? (
            <Select
              value={filterWorkspaceId ?? ''}
              onChange={(e) => {
                setFilterWorkspaceId(e.target.value || null)
                setFilterPageId(null)
              }}
              className="h-9 w-40"
              aria-label="Filter calendar by workspace"
            >
              <option value="">Current workspace</option>
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </Select>
          ) : null}
          {/* Account / page / profile filter - adapts to the selected platform.
              Facebook/Instagram filter the calendar by page; LinkedIn/X show the
              connected profile for visibility (read-only). */}
          {accountsForPlatform.length > 0 ? (
            isPageFilterablePlatform ? (
              <Select
                value={filterPageId ?? ''}
                onChange={(e) => setFilterPageId(e.target.value || null)}
                className="h-9 w-44"
                aria-label={`Filter calendar by ${accountFilterLabel}`}
              >
                <option value="">{`All ${accountFilterLabel}s`}</option>
                {accountsForPlatform.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </Select>
            ) : (
              <Select
                value={accountsForPlatform[0].id}
                disabled
                className="h-9 w-44"
                aria-label={`Connected ${accountFilterLabel}`}
                title={`Connected ${platformFilter === 'x' ? 'X' : 'LinkedIn'} ${accountFilterLabel}`}
              >
                {accountsForPlatform.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </Select>
            )
          ) : null}
          <Select
            value={platformFilter}
            onChange={(e) => {
              const p = e.target.value
              setPlatformFilter(p)
              // Clear page filter when switching to a platform that has no FB pages
              if (p !== 'all' && p !== 'facebook' && p !== 'instagram') {
                setFilterPageId(null)
              }
            }}
            className="h-9 w-44"
            aria-label="Filter calendar by account"
          >
            <option value="all">All accounts</option>
            {availablePlatforms.map((platform) => (
              <option key={platform} value={platform}>
                {PLATFORM_LABELS[platform] ?? platform}
              </option>
            ))}
          </Select>
        </div>
      </header>

      <Card className="flex min-h-[calc(100vh-8.5rem)] flex-1 flex-col overflow-hidden">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2 p-3">
          {plannerMessage ? (
            <div className="shrink-0 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
              {plannerMessage}
            </div>
          ) : null}

          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide text-foreground">Legend</span>
            <div className="flex flex-wrap items-center gap-3">
              {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                <span key={key} className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: PLATFORM_COLORS[key] }}
                  />
                  {label}
                </span>
              ))}
            </div>
            <span className="hidden h-3 w-px bg-border sm:block" />
            <div className="flex flex-wrap items-center gap-3">
              {KIND_BADGES.map((badge) => (
                <span key={badge.id} className="inline-flex items-center gap-1.5">
                  <span className={cn('text-[12px] leading-none', badge.className)}>{badge.symbol}</span>
                  {badge.label}
                </span>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading planner…</div>
          ) : (
            <div
              className="flex flex-1 overflow-auto rounded-xl border bg-card"
              style={{ minHeight: CALENDAR_GRID_MIN_PX + 40 }}
            >
              <div className="flex w-14 shrink-0 flex-col border-r bg-muted/30">
                <div className="h-11 shrink-0 border-b" />
                <div className="flex flex-col" style={{ minHeight: CALENDAR_GRID_MIN_PX }}>
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="flex shrink-0 items-start justify-end border-b pr-2 pt-1 text-right text-[10px] text-muted-foreground"
                      style={{ minHeight: HOUR_SLOT_MIN_PX }}
                    >
                      <span>{format(setHours(new Date(), hour), 'ha')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid min-w-0 flex-1 grid-cols-7">
                {weekDays.map((day) => (
                  <div key={day.toISOString()} className={cn('flex flex-col border-r last:border-r-0', isSameDay(day, today) && 'bg-primary/5')}>
                    <div
                      className={cn(
                        'flex h-11 shrink-0 flex-col items-center justify-center border-b px-1',
                        isSameDay(day, today) && 'text-primary'
                      )}
                    >
                      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{format(day, 'EEE')}</div>
                      <div className="text-base font-semibold leading-none">{format(day, 'd')}</div>
                    </div>
                    <div
                      className="relative flex flex-col"
                      style={{ minHeight: CALENDAR_GRID_MIN_PX }}
                    >
                      {HOURS.map((hour) => (
                        <button
                          key={hour}
                          type="button"
                          className="w-full shrink-0 border-b border-dashed border-border/60 last:border-b-0 hover:bg-accent/40"
                          style={{ minHeight: HOUR_SLOT_MIN_PX }}
                          onClick={() => openNewTask(day, hour)}
                        />
                      ))}
                      {visibleEvents
                        .filter((event) => isSameDay(event.start, day))
                        .map((event) => {
                          const eventMinutes = event.start.getHours() * 60 + event.start.getMinutes()
                          const gridStartMinutes = GRID_START_HOUR * 60
                          const gridEndMinutes = GRID_END_HOUR * 60
                          const durationMinutes = Math.max(
                            Math.round((event.end.getTime() - event.start.getTime()) / (1000 * 60)),
                            30
                          )
                          const boundedStart = Math.max(eventMinutes, gridStartMinutes)
                          const boundedEnd = Math.min(eventMinutes + durationMinutes, gridEndMinutes)
                          const visibleMinutes = boundedEnd - boundedStart

                          if (visibleMinutes <= 0) {
                            return null
                          }

                          const topPct = ((boundedStart - gridStartMinutes) / GRID_TOTAL_MINUTES) * 100
                          const heightPct = Math.max((visibleMinutes / GRID_TOTAL_MINUTES) * 100, 4)
                          const safeTop = Math.max(0, Math.min(topPct, 100 - 4))
                          const safeHeight = Math.max(4, Math.min(heightPct, 100 - safeTop))
                          const kindBadge = KIND_BADGES.find((entry) => entry.id === event.kind)

                          return (
                            <button
                              key={event.id}
                              type="button"
                              className="absolute left-0.5 right-0.5 overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] leading-snug text-white shadow-sm transition hover:brightness-95"
                              style={{ top: `${safeTop}%`, height: `${safeHeight}%`, backgroundColor: event.color }}
                              onClick={() => {
                                const task = tasks.find((item) => item.id === event.id)
                                if (!task) return
                                if (task.kind === 'post') {
                                  setPreviewTask(task)
                                } else {
                                  setEditingTask(task)
                                  setShowDialog(true)
                                }
                              }}
                            >
                              <div className="flex items-center gap-1 truncate font-semibold">
                                {kindBadge ? <span aria-hidden>{kindBadge.symbol}</span> : null}
                                <span className="truncate">{event.title}</span>
                              </div>
                              <div className="truncate opacity-90">
                                {format(event.start, 'h:mm a')}
                              </div>
                            </button>
                          )
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogHeader>
          <DialogTitle>{editingTask?.id ? 'Edit event' : 'New event'}</DialogTitle>
          <DialogDescription>Schedule a post, ad, or general event.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={editingTask?.title || ''}
              onChange={(e) => setEditingTask((t) => (t ? { ...t, title: e.target.value } : null))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={editingTask?.description || ''}
              onChange={(e) => setEditingTask((t) => (t ? { ...t, description: e.target.value } : null))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Scheduled at</label>
              <Input
                type="datetime-local"
                value={editingTask ? format(parseISO(editingTask.scheduled_at), "yyyy-MM-dd'T'HH:mm") : ''}
                onChange={(e) =>
                  setEditingTask((t) => (t ? { ...t, scheduled_at: new Date(e.target.value).toISOString() } : null))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Duration (min)</label>
              <Input
                type="number"
                value={editingTask?.duration_minutes || 60}
                onChange={(e) => setEditingTask((t) => (t ? { ...t, duration_minutes: Number(e.target.value) } : null))}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Kind</label>
              <Select
                value={editingTask?.kind || 'post'}
                onChange={(e) =>
                  setEditingTask((task) =>
                    task ? { ...task, kind: e.target.value as PlannerTask['kind'] } : null
                  )
                }
              >
                <option value="post">Post</option>
                <option value="ad">Ad</option>
                <option value="event">Event</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Platform</label>
              <Select
                value={editingTask?.platform || ''}
                onChange={(e) => {
                  const newPlatform = (e.target.value || null) as PlannerTask['platform']
                  setEditingTask((task) => {
                    if (!task) return null
                    // Auto-select the first matching account when switching platform
                    let pageId: string | null = task.facebook_page_id
                    if (newPlatform === 'facebook') {
                      pageId = task.facebook_page_id || filterPages[0]?.id || null
                    } else if (newPlatform === 'instagram') {
                      pageId = filterIgAccounts[0]?.id || null
                    } else {
                      pageId = null
                    }
                    return { ...task, platform: newPlatform, facebook_page_id: pageId }
                  })
                }}
              >
                <option value="">None</option>
                <option value="facebook">Facebook</option>
                {filterIgAccounts.length > 0 ? <option value="instagram">Instagram</option> : null}
                <option value="linkedin">LinkedIn</option>
                <option value="x">X</option>
                <option value="meta_ads">Meta Ads</option>
                <option value="google">Google</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={editingTask?.status || 'draft'}
                onChange={(e) =>
                  setEditingTask((task) =>
                    task ? { ...task, status: e.target.value as PlannerTask['status'] } : null
                  )
                }
              >
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
                <option value="failed">Failed</option>
              </Select>
            </div>
          </div>
          {/* Page / account selector - only shown when the platform has connected accounts */}
          {editingTask?.platform === 'facebook' && filterPages.length > 0 ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">Facebook Page</label>
              <Select
                value={editingTask.facebook_page_id || ''}
                onChange={(e) =>
                  setEditingTask((task) =>
                    task ? { ...task, facebook_page_id: e.target.value || null } : null
                  )
                }
              >
                <option value=""> - choose a page - </option>
                {filterPages.map((page) => (
                  <option key={page.id} value={page.id}>{page.name}</option>
                ))}
              </Select>
            </div>
          ) : editingTask?.platform === 'instagram' && filterIgAccounts.length > 0 ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">Instagram Account</label>
              <Select
                value={editingTask.facebook_page_id || ''}
                onChange={(e) =>
                  setEditingTask((task) =>
                    task ? { ...task, facebook_page_id: e.target.value || null } : null
                  )
                }
              >
                <option value=""> - choose an account - </option>
                {filterIgAccounts.map((acct) => (
                  <option key={acct.id} value={acct.id}>@{acct.username}</option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          {editingTask?.id ? (
            <Button variant="destructive" onClick={removeTask}>
              Delete
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setShowDialog(false)}>
            Close
          </Button>
          <Button onClick={saveTask}>OK</Button>
        </DialogFooter>
      </Dialog>

      <Dialog
        open={Boolean(previewTask)}
        onOpenChange={(open) => {
          if (!open) setPreviewTask(null)
        }}
        panelClassName="w-full max-w-2xl p-0"
      >
        {previewTask ? (
          <div className="flex max-h-[92vh] flex-col">
            <DialogHeader className="border-b px-6 py-5">
              <DialogTitle className="flex items-center gap-3">
                <span>{previewTask.title || 'Scheduled post'}</span>
                <Badge variant={previewTask.status === 'published' ? 'default' : previewTask.status === 'failed' ? 'destructive' : 'secondary'} className="capitalize">
                  {previewTask.status}
                </Badge>
                {previewTask.platform ? (
                  <Badge variant="outline" className="capitalize">{previewTask.platform.replace('_', ' ')}</Badge>
                ) : null}
              </DialogTitle>
              <DialogDescription>
                {format(parseISO(previewTask.scheduled_at), 'EEEE, MMM d, yyyy · h:mm a')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 overflow-y-auto bg-muted/30 px-6 py-5">
              {previewTask.platform && ['facebook', 'instagram', 'linkedin', 'x'].includes(previewTask.platform) ? (
                <PlatformPostPreview
                  platform={previewTask.platform as PreviewPlatform}
                  brandName={currentWorkspace?.name ?? 'Your brand'}
                  content={previewTask.description ?? ''}
                  mediaUrl={
                    (previewTask.payload?.media_urls?.[0] as string | undefined) ||
                    (previewTask.payload?.media?.[0] as string | undefined) ||
                    null
                  }
                  mediaType={
                    typeof previewTask.payload?.media_urls?.[0] === 'string' &&
                    /\.(mp4|webm|mov)(\?|$)/i.test(previewTask.payload.media_urls[0] as string)
                      ? 'video'
                      : 'image'
                  }
                  scheduledAt={previewTask.scheduled_at}
                  status={previewTask.status === 'published' ? 'posted' : 'scheduled'}
                />
              ) : (
                <div className="rounded-2xl border bg-background p-5">
                  <p className="whitespace-pre-wrap text-sm">{previewTask.description || 'No description.'}</p>
                </div>
              )}

              {previewTask.payload?.link_url ? (
                <a
                  href={previewTask.payload.link_url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  {previewTask.payload.link_url as string}
                </a>
              ) : null}
            </div>

            <DialogFooter className="border-t bg-background px-6 py-4">
              <Button variant="outline" onClick={() => navigate('/app/history')}>
                Open {APP_PAGE.activityLog}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingTask(previewTask)
                  setPreviewTask(null)
                  setShowDialog(true)
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button onClick={() => setPreviewTask(null)}>OK</Button>
            </DialogFooter>
          </div>
        ) : null}
      </Dialog>
    </div>
  )
}
