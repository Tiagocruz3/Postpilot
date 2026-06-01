import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { adminListUsageLogs } from '@/lib/admin/rpc'
import type { AdminUsageLogRow } from '@/lib/admin/types'
import { ACTION_LABELS, type CreditActionType } from '@/lib/credits/constants'

export function AdminUsageLogsTab() {
  const [logs, setLogs] = useState<AdminUsageLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')

  useEffect(() => {
    void adminListUsageLogs(300)
      .then(setLogs)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return logs.filter((log) => {
      if (q && !log.user_email.toLowerCase().includes(q) && !log.user_name.toLowerCase().includes(q)) return false
      if (roleFilter !== 'all' && log.role !== roleFilter) return false
      if (actionFilter !== 'all' && log.action_type !== actionFilter) return false
      return true
    })
  }, [logs, search, roleFilter, actionFilter])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage logs</CardTitle>
        <CardDescription>AI credit usage across all users.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input className="max-w-xs" placeholder="Filter by user" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select className="w-28" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
          </Select>
          <Select className="w-40" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="all">All actions</option>
            {(Object.keys(ACTION_LABELS) as CreditActionType[]).map((key) => (
              <option key={key} value={key}>{ACTION_LABELS[key]}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading usage logs…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Provider</th>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2 text-right">Credits</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                      No usage logs yet.
                    </td>
                  </tr>
                ) : (
                  filtered.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <p className="font-medium">{log.user_name}</p>
                        <p className="text-xs text-muted-foreground">{log.user_email}</p>
                      </td>
                      <td className="px-3 py-2 capitalize">{log.role}</td>
                      <td className="px-3 py-2 capitalize">{log.plan}</td>
                      <td className="px-3 py-2">
                        {ACTION_LABELS[log.action_type as CreditActionType] ?? log.action_type}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{log.ai_provider}</td>
                      <td className="px-3 py-2 text-muted-foreground">{log.model_used ?? ' - '}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{log.credits_used}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {log.balance_after == null ? '∞' : log.balance_after}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {format(new Date(log.created_at), 'MMM d, h:mm a')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
