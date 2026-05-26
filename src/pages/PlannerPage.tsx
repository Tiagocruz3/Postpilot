import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { usePlannerTasks } from '@/hooks/usePlannerTasks'
import { CalendarEvent, PlannerTask, Workspace } from '@/types'
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
import { Button } from '@/components/ui/button'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OutletContext {
  currentWorkspaceId: string | null
  currentWorkspace: Workspace | null
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7)
const PLATFORM_COLORS: Record<string, string> = {
  facebook: '#1877F2',
  linkedin: '#0A66C2',
  x: '#000000',
  meta_ads: '#F02849',
  google: '#EA4335',
}

export function PlannerPage() {
  const { currentWorkspaceId, currentWorkspace } = useOutletContext<OutletContext>()
  const { user } = useAuth()
  const { tasks, createTask, updateTask, deleteTask, loading } = usePlannerTasks(currentWorkspaceId || undefined)
  const [weekOffset, setWeekOffset] = useState(0)
  const [showDialog, setShowDialog] = useState(false)
  const [editingTask, setEditingTask] = useState<PlannerTask | null>(null)

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

    if (editingTask.id) {
      await updateTask(editingTask.id, payload)
    } else {
      await createTask(payload)
    }
    setShowDialog(false)
    setEditingTask(null)
  }

  const removeTask = async () => {
    if (!editingTask?.id) return
    await deleteTask(editingTask.id)
    setShowDialog(false)
    setEditingTask(null)
  }

  return (
    <div className="flex h-full flex-col p-6">
      <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Planner</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {currentWorkspace?.name ?? 'Workspace'} calendar for social posts, ad launches, and imported Google events.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border bg-card px-3 py-2">
            <button type="button" onClick={() => setWeekOffset((o) => o - 1)} className="rounded-md p-1 hover:bg-accent">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium">
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </span>
            <button type="button" onClick={() => setWeekOffset((o) => o + 1)} className="rounded-md p-1 hover:bg-accent">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={() => openNewTask()}>
            <Plus className="mr-2 h-4 w-4" />
            New planner item
          </Button>
        </div>
      </header>

      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>Week view</CardTitle>
          <CardDescription>Visual time-grid for scheduled posts, ads, and Google Calendar events.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading planner…</div>
          ) : (
            <div className="h-full overflow-auto">
              <div className="flex min-w-[980px] rounded-3xl border bg-card">
                <div className="w-20 shrink-0 border-r bg-muted/30">
                  <div className="h-14 border-b" />
                  {HOURS.map((hour) => (
                    <div key={hour} className="relative h-20 border-b pr-3 text-right text-xs text-muted-foreground">
                      <span className="absolute -top-2 right-3">{format(setHours(new Date(), hour), 'ha')}</span>
                    </div>
                  ))}
                </div>

                <div className="grid flex-1 grid-cols-7">
                  {weekDays.map((day) => (
                    <div key={day.toISOString()} className={cn('border-r', isSameDay(day, today) && 'bg-primary/5')}>
                      <div
                        className={cn(
                          'h-14 border-b px-3 py-2 text-center',
                          isSameDay(day, today) && 'text-primary'
                        )}
                      >
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{format(day, 'EEE')}</div>
                        <div className="mt-1 text-lg font-semibold">{format(day, 'd')}</div>
                      </div>
                      <div className="relative">
                        {HOURS.map((hour) => (
                          <button
                            key={hour}
                            type="button"
                            className="h-20 w-full border-b border-dashed border-border/60 hover:bg-accent/40"
                            onClick={() => openNewTask(day, hour)}
                          />
                        ))}
                        {events
                          .filter((event) => isSameDay(event.start, day))
                          .map((event) => {
                            const eventHourOffset = event.start.getHours() - HOURS[0]
                            const top = eventHourOffset * 80 + (event.start.getMinutes() / 60) * 80
                            const height = Math.max(
                              ((event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60)) * 80,
                              32
                            )

                            return (
                              <button
                                key={event.id}
                                type="button"
                                className="absolute left-2 right-2 rounded-2xl px-3 py-2 text-left text-xs text-white shadow-sm transition hover:brightness-95"
                                style={{ top, height, backgroundColor: event.color }}
                                onClick={() => {
                                  const task = tasks.find((item) => item.id === event.id)
                                  if (task) {
                                    setEditingTask(task)
                                    setShowDialog(true)
                                  }
                                }}
                              >
                                <div className="truncate font-semibold">{event.title}</div>
                                <div className="mt-1 flex items-center gap-1.5 opacity-90">
                                  {event.platform ? <span className="capitalize">{event.platform.replace('_', ' ')}</span> : null}
                                  <span>{format(event.start, 'h:mm a')}</span>
                                </div>
                              </button>
                            )
                          })}
                      </div>
                    </div>
                  ))}
                </div>
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
                onChange={(e) =>
                  setEditingTask((task) =>
                    task ? { ...task, platform: (e.target.value || null) as PlannerTask['platform'] } : null
                  )
                }
              >
                <option value="">None</option>
                <option value="facebook">Facebook</option>
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
        </div>
        <DialogFooter>
          {editingTask?.id ? (
            <Button variant="destructive" onClick={removeTask}>
              Delete
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setShowDialog(false)}>
            Cancel
          </Button>
          <Button onClick={saveTask}>Save</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
