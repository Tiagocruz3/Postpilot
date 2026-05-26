import { useOutletContext, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { usePlannerTasks } from '@/hooks/usePlannerTasks'
import { Workspace } from '@/types'
import { parseISO, isAfter, isBefore, addDays } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CalendarDays,
  PenTool,
  BarChart3,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Images,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPreferredDisplayName, loadUserPreferences } from '@/lib/user-preferences'

interface OutletContext {
  currentWorkspaceId: string | null
  currentWorkspace: Workspace | null
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { currentWorkspaceId, currentWorkspace } = useOutletContext<OutletContext>()
  const { profile } = useAuth()
  const { tasks, loading } = usePlannerTasks(currentWorkspaceId || undefined)
  const userPreferences = loadUserPreferences()
  const displayName = getPreferredDisplayName(profile?.display_name, userPreferences)

  const today = new Date()
  const upcomingTasks = tasks
    .filter((t) => isAfter(parseISO(t.scheduled_at), today))
    .sort((a, b) => parseISO(a.scheduled_at).getTime() - parseISO(b.scheduled_at).getTime())

  const thisWeekTasks = upcomingTasks.filter((t) => isBefore(parseISO(t.scheduled_at), addDays(today, 7)))
  const draftCount = tasks.filter((t) => t.status === 'draft').length
  const scheduledCount = tasks.filter((t) => t.status === 'scheduled').length
  const publishedCount = tasks.filter((t) => t.status === 'published').length

  const quickActions = [
    {
      label: 'Planner',
      description: 'View calendar and schedule posts',
      icon: CalendarDays,
      path: '/planner',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Compose',
      description: 'Draft and publish social posts',
      icon: PenTool,
      path: '/compose',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'AI Library',
      description: 'Reuse generated images and videos',
      icon: Images,
      path: '/library',
      color: 'bg-violet-50 text-violet-600',
    },
    {
      label: 'Ads',
      description: 'Manage campaigns and AI variants',
      icon: BarChart3,
      path: '/ads',
      color: 'bg-amber-50 text-amber-600',
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <section>
        <Card className="border-primary/15">
          <CardHeader>
            <CardTitle className="text-3xl font-semibold tracking-tight">Welcome back, {displayName}</CardTitle>
            <CardDescription>
              {currentWorkspace?.name ?? 'Workspace'} overview. Posts and AI assets are isolated to this workspace for
              all members.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border bg-background p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Published</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{publishedCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Live posts recorded in the planner</p>
            </div>
            <div className="rounded-2xl border bg-background p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Scheduled</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{scheduledCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Waiting to go out</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{upcomingTasks.length}</p>
              <p className="text-xs text-muted-foreground">Upcoming items</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
              <AlertCircle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{draftCount}</p>
              <p className="text-xs text-muted-foreground">Drafts</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{scheduledCount}</p>
              <p className="text-xs text-muted-foreground">Scheduled</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <CalendarDays className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{thisWeekTasks.length}</p>
              <p className="text-xs text-muted-foreground">Due this week</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming planner items</CardTitle>
              <CardDescription>Your next scheduled posts, ads, and events.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/planner')}>
              View planner
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : upcomingTasks.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No upcoming items. Go to the planner to schedule your first post.
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingTasks.slice(0, 6).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-2xl border bg-background p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(task.scheduled_at).toLocaleString(userPreferences.locale, {
                          timeZone: userPreferences.timeZone,
                        })}
                        {task.platform ? ` · ${task.platform.replace('_', ' ')}` : ''}
                      </p>
                    </div>
                    <Badge
                      variant={
                        task.status === 'failed'
                          ? 'destructive'
                          : task.status === 'published'
                            ? 'default'
                            : 'secondary'
                      }
                    >
                      {task.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Jump straight into your workflow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.path}
                  onClick={() => navigate(action.path)}
                  className="flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors hover:bg-accent/40"
                >
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', action.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )
            })}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
