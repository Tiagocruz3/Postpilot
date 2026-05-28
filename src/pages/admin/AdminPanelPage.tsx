import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  CreditCard,
  Coins,
  FileText,
  Package,
  Settings,
  Shield,
  Users,
  Zap,
} from 'lucide-react'
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
  const [tab, setTab] = useState<AdminTabId>('users')
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

  const activeMembers = users.filter((u) => u.role === 'member' && u.subscription_status === 'active').length
  const mrr = users.reduce((sum, u) => {
    if (u.role === 'admin') return sum
    const plan = config?.plans.find((p) => p.id === u.plan)
    return sum + (plan?.monthly_price ?? 0)
  }, 0)

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
            <MetricCard label="Total users" value={String(users.length)} />
            <MetricCard label="Active members" value={String(activeMembers)} />
            <MetricCard label="Est. MRR" value={`$${mrr.toLocaleString()}`} />
            <MetricCard label="Plans active" value={String(config?.plans.filter((p) => p.status === 'active').length ?? 0)} />
          </div>

          {loading || !config ? (
            <p className="text-sm text-muted-foreground">Loading subscription data…</p>
          ) : (
            <>
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}
