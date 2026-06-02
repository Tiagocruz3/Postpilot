import { useMemo } from 'react'
import { format } from 'date-fns'
import { Activity, TrendingUp, Users } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminUserRow, SubscriptionPlanRow } from '@/lib/admin/types'
import { cn } from '@/lib/utils'

type AdminOverviewTabProps = {
  users: AdminUserRow[]
  plans: SubscriptionPlanRow[]
  onJumpToUsers: () => void
}

function initials(name: string, email: string) {
  const source = name?.trim() || email?.trim() || '?'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export function AdminOverviewTab({ users, plans, onJumpToUsers }: AdminOverviewTabProps) {
  const members = useMemo(() => users.filter((u) => u.role === 'member'), [users])

  const planBreakdown = useMemo(() => {
    const counts = new Map<string, number>()
    for (const u of members) counts.set(u.plan, (counts.get(u.plan) ?? 0) + 1)
    return plans
      .map((p) => ({ id: p.id, name: p.name, count: counts.get(p.id) ?? 0, price: p.monthly_price }))
      .sort((a, b) => b.count - a.count)
  }, [members, plans])

  const statusBreakdown = useMemo(() => {
    const counts = new Map<string, number>()
    for (const u of users) counts.set(u.subscription_status, (counts.get(u.subscription_status) ?? 0) + 1)
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [users])

  const recentSignups = useMemo(
    () =>
      [...users]
        .sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime())
        .slice(0, 6),
    [users],
  )

  const totalCreditsUsed = useMemo(
    () => members.reduce((sum, u) => sum + u.credits_used, 0),
    [members],
  )
  const totalTopupBalance = useMemo(
    () => members.reduce((sum, u) => sum + u.topup_credits, 0),
    [members],
  )

  const maxPlanCount = Math.max(1, ...planBreakdown.map((p) => p.count))

  const statusTone: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    trialing: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
    past_due: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    cancelled: 'bg-muted text-muted-foreground',
    suspended: 'bg-destructive/15 text-destructive',
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Plan distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Plan distribution
          </CardTitle>
          <CardDescription>How members are spread across membership plans.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {planBreakdown.map((p) => (
            <div key={p.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium capitalize">{p.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {p.count} {p.count === 1 ? 'member' : 'members'}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-sky-500"
                  style={{ width: `${(p.count / maxPlanCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {planBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No plans configured yet.</p>
          ) : null}
        </CardContent>
      </Card>

      {/* Status + credit summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            Account status
          </CardTitle>
          <CardDescription>Subscription status across all accounts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {statusBreakdown.map(([status, count]) => (
              <Badge
                key={status}
                variant="secondary"
                className={cn('gap-1.5 capitalize', statusTone[status] ?? '')}
              >
                {status.replace('_', ' ')}
                <span className="font-semibold tabular-nums">{count}</span>
              </Badge>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Credits consumed</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">
                {totalCreditsUsed.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Top-up balance</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">
                {totalTopupBalance.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent signups */}
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Recent signups
            </CardTitle>
            <CardDescription>The newest accounts to join.</CardDescription>
          </div>
          <button
            type="button"
            onClick={onJumpToUsers}
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </button>
        </CardHeader>
        <CardContent>
          {recentSignups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <div className="divide-y">
              {recentSignups.map((user) => (
                <div key={user.user_id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback
                      className={cn(
                        'text-[11px]',
                        user.role === 'admin' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {initials(user.name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant="secondary" className="capitalize">{user.plan}</Badge>
                  <span className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline">
                    {format(new Date(user.joined_at), 'MMM d, yyyy')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
