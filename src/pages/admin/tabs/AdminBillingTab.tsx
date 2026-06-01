import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminUserRow, SubscriptionPlanRow, TopupPackRow } from '@/lib/admin/types'

type AdminBillingTabProps = {
  users: AdminUserRow[]
  plans: SubscriptionPlanRow[]
  topups: TopupPackRow[]
}

export function AdminBillingTab({ users, plans, topups }: AdminBillingTabProps) {
  const members = users.filter((u) => u.role === 'member')

  const stats = useMemo(() => {
    const active = members.filter((u) => u.subscription_status === 'active').length
    const cancelled = members.filter((u) => u.subscription_status === 'cancelled').length
    const trial = members.filter((u) => u.subscription_status === 'trialing').length
    const pastDue = members.filter((u) => u.subscription_status === 'past_due').length
    const mrr = members.reduce((sum, u) => {
      const plan = plans.find((p) => p.id === u.plan)
      return sum + (plan?.monthly_price ?? 0)
    }, 0)
    const revenueByPlan = plans.map((p) => ({
      plan: p.name,
      count: members.filter((u) => u.plan === p.id && u.subscription_status === 'active').length,
      revenue: members.filter((u) => u.plan === p.id && u.subscription_status === 'active').length * p.monthly_price,
    }))
    return { active, cancelled, trial, pastDue, mrr, revenueByPlan }
  }, [members, plans])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="MRR" value={`$${stats.mrr.toLocaleString()}`} />
        <Stat label="Active" value={String(stats.active)} />
        <Stat label="Trials" value={String(stats.trial)} />
        <Stat label="Cancelled" value={String(stats.cancelled)} />
        <Stat label="Past due" value={String(stats.pastDue)} />
        <Stat label="Top-up packs" value={String(topups.filter((t) => t.active).length)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue by plan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {stats.revenueByPlan.map((row) => (
            <div key={row.plan} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{row.plan}</p>
              <p className="text-muted-foreground">{row.count} subscribers</p>
              <p className="text-lg font-semibold">${row.revenue.toLocaleString()}/mo</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
          <CardDescription>Connect Stripe for live payment data. Showing account-level subscription state.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Cycle</th>
                <th className="px-3 py-2">Payment</th>
              </tr>
            </thead>
            <tbody>
              {members.map((user) => {
                const plan = plans.find((p) => p.id === user.plan)
                return (
                  <tr key={user.user_id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{user.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{user.email}</td>
                    <td className="px-3 py-2 capitalize">{user.plan}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="capitalize">{user.subscription_status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right">${plan?.monthly_price ?? 0}/mo</td>
                    <td className="px-3 py-2">Monthly</td>
                    <td className="px-3 py-2">
                      {user.subscription_status === 'past_due' ? (
                        <span className="text-destructive">Failed</span>
                      ) : (
                        <span className="text-muted-foreground"> - </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}
