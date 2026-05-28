import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Search } from 'lucide-react'
import { useConfirm } from '@/components/ConfirmProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { adminAdjustCredits, adminUpdateUser } from '@/lib/admin/rpc'
import type { AdminUserRow, SubscriptionPlanRow } from '@/lib/admin/types'

type AdminUsersTabProps = {
  users: AdminUserRow[]
  plans: SubscriptionPlanRow[]
  onRefresh: () => Promise<void>
  onMessage: (msg: string) => void
}

export function AdminUsersTab({ users, plans, onRefresh, onMessage }: AdminUsersTabProps) {
  const confirm = useConfirm()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editUser, setEditUser] = useState<AdminUserRow | null>(null)
  const [creditUser, setCreditUser] = useState<AdminUserRow | null>(null)
  const [topupAmount, setTopupAmount] = useState('500')
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = search.trim().toLowerCase()
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (planFilter !== 'all' && u.plan !== planFilter) return false
      if (statusFilter !== 'all' && u.subscription_status !== statusFilter) return false
      return true
    })
  }, [users, search, roleFilter, planFilter, statusFilter])

  const handleSuspend = async (user: AdminUserRow, suspend: boolean) => {
    const ok = await confirm({
      title: suspend ? `Suspend ${user.name}?` : `Reactivate ${user.name}?`,
      description: suspend ? 'They will lose access to AI generation until reactivated.' : 'Account access will be restored.',
      confirmLabel: suspend ? 'Suspend' : 'Reactivate',
      variant: suspend ? 'destructive' : 'default',
    })
    if (!ok) return
    setBusy(true)
    try {
      await adminUpdateUser({
        userId: user.user_id,
        suspend,
        subscriptionStatus: suspend ? 'suspended' : 'active',
      })
      onMessage(suspend ? 'User suspended.' : 'User reactivated.')
      await onRefresh()
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Update failed.')
    } finally {
      setBusy(false)
    }
  }

  const saveEdit = async () => {
    if (!editUser) return
    setBusy(true)
    try {
      await adminUpdateUser({
        userId: editUser.user_id,
        role: editUser.role,
        plan: editUser.plan,
        subscriptionStatus: editUser.subscription_status,
      })
      onMessage('User updated.')
      setEditUser(null)
      await onRefresh()
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  const applyCredits = async (give: boolean) => {
    if (!creditUser) return
    const amount = Number(topupAmount) || 0
    if (amount <= 0) return
    const ok = await confirm({
      title: give ? `Give ${amount} credits?` : `Remove ${amount} credits?`,
      description: give ? 'Top-up credits will be added to this user.' : 'Credits will be deducted from top-up balance first.',
      confirmLabel: give ? 'Give credits' : 'Remove credits',
      variant: give ? 'default' : 'destructive',
    })
    if (!ok) return
    setBusy(true)
    try {
      await adminAdjustCredits({
        userId: creditUser.user_id,
        topupDelta: give ? amount : -amount,
      })
      onMessage('Credits updated.')
      setCreditUser(null)
      await onRefresh()
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Credit adjustment failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Manage accounts, roles, plans, and credits.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select className="w-32" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </Select>
            <Select className="w-32" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
              <option value="all">All plans</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            <Select className="w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="trialing">Trial</option>
              <option value="past_due">Past due</option>
              <option value="cancelled">Cancelled</option>
              <option value="suspended">Suspended</option>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Monthly</th>
                  <th className="px-3 py-2 text-right">Top-up</th>
                  <th className="px-3 py-2 text-right">Used</th>
                  <th className="px-3 py-2">Joined</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.user_id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{user.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{user.email}</td>
                    <td className="px-3 py-2 capitalize">{user.role}</td>
                    <td className="px-3 py-2 capitalize">{user.plan}</td>
                    <td className="px-3 py-2">
                      <Badge variant={user.subscription_status === 'active' ? 'default' : 'secondary'} className="capitalize">
                        {user.subscription_status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{user.role === 'admin' ? '∞' : user.monthly_credits.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{user.topup_credits.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{user.credits_used.toLocaleString()}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {format(new Date(user.joined_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditUser({ ...user })}>
                          Edit
                        </Button>
                        {user.role !== 'admin' ? (
                          <>
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => setCreditUser(user)}>
                              Credits
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => void handleSuspend(user, !user.suspended_at)}
                            >
                              {user.suspended_at ? 'Activate' : 'Suspend'}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editUser)} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>{editUser?.email}</DialogDescription>
        </DialogHeader>
        {editUser ? (
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select value={editUser.role} onChange={(e) => setEditUser({ ...editUser, role: e.target.value as 'admin' | 'member' })}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Plan</Label>
              <Select value={editUser.plan} onChange={(e) => setEditUser({ ...editUser, plan: e.target.value })}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Subscription status</Label>
              <Select
                value={editUser.subscription_status}
                onChange={(e) => setEditUser({ ...editUser, subscription_status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="trialing">Trialing</option>
                <option value="past_due">Past due</option>
                <option value="cancelled">Cancelled</option>
                <option value="suspended">Suspended</option>
              </Select>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
          <Button disabled={busy} onClick={() => void saveEdit()}>Save</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={Boolean(creditUser)} onOpenChange={(open) => !open && setCreditUser(null)}>
        <DialogHeader>
          <DialogTitle>Adjust credits</DialogTitle>
          <DialogDescription>{creditUser?.email}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5 py-2">
          <Label>Credit amount</Label>
          <Input type="number" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreditUser(null)}>Cancel</Button>
          <Button variant="destructive" disabled={busy} onClick={() => void applyCredits(false)}>
            Remove
          </Button>
          <Button disabled={busy} onClick={() => void applyCredits(true)}>
            Give credits
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
