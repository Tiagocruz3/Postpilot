import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  CreditCard,
  Coins,
  DollarSign,
  FileText,
  LayoutDashboard,
  Package,
  Power,
  RefreshCw,
  Settings,
  Shield,
  Users,
  UserCheck,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AdminOverviewTab } from '@/pages/admin/tabs/AdminOverviewTab'
import { AdminUsersTab } from '@/pages/admin/tabs/AdminUsersTab'
import { AdminPlansTab } from '@/pages/admin/tabs/AdminPlansTab'
import { AdminCreditsTab } from '@/pages/admin/tabs/AdminCreditsTab'
import { AdminTopUpsTab } from '@/pages/admin/tabs/AdminTopUpsTab'
import { AdminBillingTab } from '@/pages/admin/tabs/AdminBillingTab'
import { AdminUsageLogsTab } from '@/pages/admin/tabs/AdminUsageLogsTab'
import { AdminSubscriptionSettingsTab } from '@/pages/admin/tabs/AdminSubscriptionSettingsTab'
import { adminGetConfig, adminListUsers } from '@/lib/admin/rpc'
import type { AdminSubscriptionConfig, AdminUserRow } from '@/lib/admin/types'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'plans', label: 'Plans', icon: Package },
  { id: 'credits', label: 'Credits', icon: Coins },
  { id: 'topups', label: 'Top-Ups', icon: Zap },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'usage', label: 'Usage Logs', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const

export type AdminTabId = (typeof TABS)[number]['id']

export function AdminPanelPage() {
  const [tab, setTab] = useState<AdminTabId>('overview')
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [config, setConfig] = useState<AdminSubscriptionConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const reload = async () => {
    setLoading(true)
    try {
      const [userRows, cfg] = await Promise.all([adminListUsers(), adminGetConfig()])
      setUsers(userRows)
      setConfig(cfg)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load admin data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const members = users.filter((u) => u.role === 'member')
  const activeMembers = members.filter((u) => u.subscription_status === 'active').length
  const suspendedMembers = members.filter((u) => u.suspended_at || u.subscription_status === 'suspended').length
  const mrr = members.reduce((sum, u) => {
    const plan = config?.plans.find((p) => p.id === u.plan)
    return sum + (plan?.monthly_price ?? 0)
  }, 0)
  const arpu = activeMembers > 0 ? Math.round(mrr / activeMembers) : 0

  return (
    <div className="min-h-full bg-muted/20">
      <div className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-accent"
              title="Back to app"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-semibold">Admin Panel</h1>
              </div>
              <p className="text-sm text-muted-foreground">Subscription Management</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void reload()}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-[220px_1fr]">
        <nav className="h-fit space-y-1 rounded-xl border bg-card p-2 lg:sticky lg:top-6">
          {TABS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  tab === item.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="min-w-0 space-y-4">
          {message ? (
            <div className="rounded-xl border bg-primary/5 px-4 py-3 text-sm" onClick={() => setMessage('')}>
              {message}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total users" value={String(users.length)} icon={Users} />
            <MetricCard label="Active members" value={String(activeMembers)} icon={UserCheck} hint={suspendedMembers > 0 ? `${suspendedMembers} suspended` : undefined} />
            <MetricCard label="Est. MRR" value={`$${mrr.toLocaleString()}`} icon={DollarSign} hint={`$${arpu.toLocaleString()} ARPU`} />
            <MetricCard label="Plans active" value={String(config?.plans.filter((p) => p.status === 'active').length ?? 0)} icon={Power} />
          </div>

          {loading || !config ? (
            <p className="text-sm text-muted-foreground">Loading subscription data…</p>
          ) : (
            <>
              {tab === 'overview' ? (
                <AdminOverviewTab users={users} plans={config.plans} onJumpToUsers={() => setTab('users')} />
              ) : null}
              {tab === 'users' ? (
                <AdminUsersTab users={users} plans={config.plans} onRefresh={reload} onMessage={setMessage} />
              ) : null}
              {tab === 'plans' ? (
                <AdminPlansTab plans={config.plans} onRefresh={reload} onMessage={setMessage} />
              ) : null}
              {tab === 'credits' ? (
                <AdminCreditsTab rules={config.credit_rules} onRefresh={reload} onMessage={setMessage} />
              ) : null}
              {tab === 'topups' ? (
                <AdminTopUpsTab packs={config.topups} onRefresh={reload} onMessage={setMessage} />
              ) : null}
              {tab === 'billing' ? (
                <AdminBillingTab users={users} plans={config.plans} topups={config.topups} />
              ) : null}
              {tab === 'usage' ? <AdminUsageLogsTab /> : null}
              {tab === 'settings' ? (
                <AdminSubscriptionSettingsTab settings={config.settings} auditLogs={config.audit_logs} onRefresh={reload} onMessage={setMessage} />
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string
  value: string
  icon?: typeof Users
  hint?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
