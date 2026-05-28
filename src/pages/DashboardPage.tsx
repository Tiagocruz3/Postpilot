import { useOutletContext, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  Heart,
  Lightbulb,
  MessageCircle,
  Megaphone,
  PenLine,
  Share2,
  Sparkles,
  Bookmark,
  FileText,
  Send,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useDashboardData } from '@/hooks/useDashboardData'
import type { Workspace } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { APP_PAGE } from '@/lib/app-labels'
import { formatScheduledLabel } from '@/lib/dashboard-stats'
import { getPreferredDisplayName, loadUserPreferences } from '@/lib/user-preferences'

interface OutletContext {
  currentWorkspaceId: string | null
  currentWorkspace: Workspace | null
}

function formatCount(value: number): string {
  return value.toLocaleString()
}

type StatCardProps = {
  label: string
  value: string
  icon: typeof FileText
  accent?: 'primary' | 'emerald' | 'violet' | 'amber' | 'rose' | 'sky'
}

const ACCENT_STYLES: Record<NonNullable<StatCardProps['accent']>, string> = {
  primary: 'from-primary/15 to-primary/5 text-primary',
  emerald: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600',
  violet: 'from-violet-500/15 to-violet-500/5 text-violet-600',
  amber: 'from-amber-500/15 to-amber-500/5 text-amber-600',
  rose: 'from-rose-500/15 to-rose-500/5 text-rose-600',
  sky: 'from-sky-500/15 to-sky-500/5 text-sky-600',
}

function StatCard({ label, value, icon: Icon, accent = 'primary' }: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-60 blur-2xl from-primary/10 to-transparent" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        </div>
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br',
            ACCENT_STYLES[accent],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function SectionDivider() {
  return <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'published') return 'default'
  if (status === 'failed') return 'destructive'
  if (status === 'scheduled') return 'secondary'
  return 'outline'
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { currentWorkspace } = useOutletContext<OutletContext>()
  const { profile } = useAuth()
  const userPreferences = loadUserPreferences()
  const displayName = getPreferredDisplayName(profile?.display_name, userPreferences)
  const { counts, metrics, activity, suggestions, upcomingScheduled, topPosts, ads, loading } =
    useDashboardData(currentWorkspace?.id)

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 pb-10">
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-card via-card to-primary/[0.06] p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{APP_PAGE.commandCenter}</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Welcome back, {displayName}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              Here&apos;s your post activity and engagement overview
              {currentWorkspace?.name ? (
                <>
                  {' '}
                  for <span className="font-medium text-foreground">{currentWorkspace.name}</span>.
                </>
              ) : (
                '.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="lg" className="h-11 shadow-sm" onClick={() => navigate('/app/compose')}>
              <PenLine className="mr-2 h-4 w-4" />
              Create Post
            </Button>
            <Button size="lg" variant="outline" className="h-11 bg-background/80" onClick={() => navigate('/app/planner')}>
              <CalendarClock className="mr-2 h-4 w-4" />
              Schedule Post
            </Button>
            <Button size="lg" variant="outline" className="h-11 bg-background/80" onClick={() => navigate('/app/ads')}>
              <Megaphone className="mr-2 h-4 w-4" />
              Create Ad
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Posts Created" value={formatCount(counts.postsCreated)} icon={FileText} accent="primary" />
        <StatCard label="Scheduled" value={formatCount(counts.scheduled)} icon={CalendarClock} accent="sky" />
        <StatCard label="Published" value={formatCount(counts.published)} icon={Send} accent="emerald" />
        <StatCard label="Engagement" value={formatCount(counts.engagement)} icon={TrendingUp} accent="violet" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Likes" value={formatCount(metrics.likes)} icon={Heart} accent="rose" />
        <StatCard label="Comments" value={formatCount(metrics.comments)} icon={MessageCircle} accent="primary" />
        <StatCard label="Shares" value={formatCount(metrics.shares)} icon={Share2} accent="amber" />
        <StatCard label="Saves" value={formatCount(metrics.saves)} icon={Bookmark} accent="emerald" />
      </section>

      <SectionDivider />

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="h-5 w-5 text-primary" />
              Post Activity
            </CardTitle>
            <CardDescription>Recent publishing wins and items that need attention.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading activity…</p>
            ) : (
              activity.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm',
                    item.tone === 'success' && 'border-emerald-500/20 bg-emerald-500/[0.04]',
                    item.tone === 'info' && 'border-primary/20 bg-primary/[0.04]',
                    item.tone === 'warning' && 'border-amber-500/25 bg-amber-500/[0.05]',
                    item.tone === 'neutral' && 'bg-muted/30',
                  )}
                >
                  <span
                    className={cn(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      item.tone === 'success' && 'bg-emerald-500',
                      item.tone === 'info' && 'bg-primary',
                      item.tone === 'warning' && 'bg-amber-500',
                      item.tone === 'neutral' && 'bg-muted-foreground',
                    )}
                  />
                  <span className="leading-relaxed">{item.text}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/15 bg-gradient-to-b from-primary/[0.04] to-card lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              AI Suggestions
            </CardTitle>
            <CardDescription>Quick wins from your posting patterns.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((item) => (
              <div key={item.id} className="rounded-xl border bg-background/80 px-4 py-3">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/app/compose')}>
              <Sparkles className="mr-2 h-4 w-4" />
              Open {APP_PAGE.createStudio}
            </Button>
          </CardContent>
        </Card>
      </section>

      <SectionDivider />

      <section>
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Upcoming Scheduled Posts</CardTitle>
              <CardDescription>Posts and ads queued on your {APP_PAGE.contentCalendar.toLowerCase()}.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/app/planner')}>
              Open {APP_PAGE.contentCalendar}
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading schedule…</p>
            ) : upcomingScheduled.length === 0 ? (
              <div className="rounded-2xl border border-dashed py-12 text-center">
                <p className="text-sm text-muted-foreground">No upcoming posts scheduled.</p>
                <Button className="mt-4" size="sm" onClick={() => navigate('/app/planner')}>
                  Schedule your first post
                </Button>
              </div>
            ) : (
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Post</th>
                    <th className="pb-3 pr-4 font-medium">Platform</th>
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingScheduled.map((task) => (
                    <tr key={task.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3.5 pr-4 font-medium">{task.title}</td>
                      <td className="py-3.5 pr-4 capitalize text-muted-foreground">
                        {task.platform?.replace('_', ' ') || (task.kind === 'ad' ? 'Meta Ads' : '—')}
                      </td>
                      <td className="py-3.5 pr-4 text-muted-foreground">
                        {formatScheduledLabel(task.scheduled_at)}
                      </td>
                      <td className="py-3.5">
                        <Badge variant={statusVariant(task.status)} className="capitalize">
                          {task.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>

      <SectionDivider />

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-primary" />
              Top Post Engagement
            </CardTitle>
            <CardDescription>Estimated engagement rate from published post metrics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading engagement…</p>
            ) : topPosts.length === 0 ? (
              <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
                Publish posts and refresh metrics in {APP_PAGE.activityLog} to rank performance.
              </div>
            ) : (
              topPosts.map((post, index) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{post.title}</p>
                      <p className="text-xs capitalize text-muted-foreground">{post.platform}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-primary">{post.rateLabel}</span>
                </div>
              ))
            )}
            <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => navigate('/app/history')}>
              View {APP_PAGE.activityLog}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-amber-500/15 bg-gradient-to-br from-amber-500/[0.05] via-card to-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Megaphone className="h-5 w-5 text-amber-600" />
              Ads Snapshot
            </CardTitle>
            <CardDescription>
              {ads.hasLiveData
                ? 'Live Meta Ads performance.'
                : `${APP_PAGE.contentCalendar} ad tasks and estimates until Meta insights sync.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border bg-background/80 p-4">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Active Ads</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{ads.activeAds}</dd>
              </div>
              <div className="rounded-xl border bg-background/80 p-4">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Spend</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{ads.spendLabel}</dd>
              </div>
              <div className="rounded-xl border bg-background/80 p-4">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Leads</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{ads.leadsLabel}</dd>
              </div>
              <div className="rounded-xl border bg-background/80 p-4">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">CPL</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{ads.cplLabel}</dd>
              </div>
            </dl>
            <Button className="mt-4 w-full" variant="outline" onClick={() => navigate('/app/ads')}>
              Manage ads
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
