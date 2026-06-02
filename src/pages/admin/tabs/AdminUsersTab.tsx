import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Check, Coins, Copy, KeyRound, Mail, Pencil, Power, Search, Trash2, UserPlus } from 'lucide-react'
import { useConfirm } from '@/components/ConfirmProvider'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  adminAdjustCredits,
  adminCreateUser,
  adminDeleteUser,
  adminSendRecovery,
  adminSetUserPassword,
  adminUpdateUser,
} from '@/lib/admin/rpc'
import type { AdminUserRow, SubscriptionPlanRow } from '@/lib/admin/types'
import { cn } from '@/lib/utils'

type CreateUserForm = {
  email: string
  password: string
  name: string
  role: 'admin' | 'member'
  plan: string
}

const EMPTY_CREATE_FORM: CreateUserForm = {
  email: '',
  password: '',
  name: '',
  role: 'member',
  plan: 'free',
}

function initials(name: string, email: string) {
  const source = name?.trim() || email?.trim() || '?'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

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
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateUserForm>(EMPTY_CREATE_FORM)
  const [pwUser, setPwUser] = useState<AdminUserRow | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [recoveryLink, setRecoveryLink] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)

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

  const handleDelete = async (user: AdminUserRow) => {
    const ok = await confirm({
      title: `Delete ${user.name || user.email}?`,
      description:
        'This permanently removes the auth account, profile, and all data they own. This cannot be undone.',
      confirmLabel: 'Delete user',
      variant: 'destructive',
    })
    if (!ok) return
    setBusy(true)
    try {
      await adminDeleteUser(user.user_id)
      onMessage(`Deleted ${user.email}.`)
      await onRefresh()
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setBusy(false)
    }
  }

  const submitCreate = async () => {
    const email = createForm.email.trim().toLowerCase()
    if (!email) {
      onMessage('Email is required.')
      return
    }
    if (createForm.password.length < 8) {
      onMessage('Password must be at least 8 characters.')
      return
    }
    setBusy(true)
    try {
      await adminCreateUser({
        email,
        password: createForm.password,
        name: createForm.name.trim() || undefined,
        role: createForm.role,
        plan: createForm.plan,
      })
      onMessage(`Created ${email}. They can sign in immediately - no email confirmation needed.`)
      setCreateOpen(false)
      setCreateForm(EMPTY_CREATE_FORM)
      await onRefresh()
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Could not create user.')
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

  const openPasswordDialog = (user: AdminUserRow) => {
    setPwUser(user)
    setNewPassword('')
    setRecoveryLink('')
    setLinkCopied(false)
  }

  const submitSetPassword = async () => {
    if (!pwUser) return
    if (newPassword.length < 8) {
      onMessage('Password must be at least 8 characters.')
      return
    }
    const ok = await confirm({
      title: `Set a new password for ${pwUser.name || pwUser.email}?`,
      description: 'This immediately overrides their password. Share the new password with them securely.',
      confirmLabel: 'Set password',
    })
    if (!ok) return
    setBusy(true)
    try {
      await adminSetUserPassword({ userId: pwUser.user_id, password: newPassword })
      onMessage(`Password updated for ${pwUser.email}.`)
      setPwUser(null)
      setNewPassword('')
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Could not set password.')
    } finally {
      setBusy(false)
    }
  }

  const sendRecovery = async () => {
    if (!pwUser) return
    setBusy(true)
    try {
      const { action_link } = await adminSendRecovery({ userId: pwUser.user_id, email: pwUser.email })
      setRecoveryLink(action_link ?? '')
      setLinkCopied(false)
      onMessage(
        action_link
          ? `Recovery link generated for ${pwUser.email}. Copy it below or it was emailed if SMTP is configured.`
          : `Recovery email sent to ${pwUser.email}.`,
      )
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Could not send recovery.')
    } finally {
      setBusy(false)
    }
  }

  const copyRecoveryLink = async () => {
    if (!recoveryLink) return
    try {
      await navigator.clipboard.writeText(recoveryLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      onMessage('Could not copy. Select and copy the link manually.')
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Users</CardTitle>
            <CardDescription>Manage accounts, roles, plans, and credits.</CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setCreateForm({
                ...EMPTY_CREATE_FORM,
                plan: plans[0]?.id ?? 'free',
              })
              setCreateOpen(true)
            }}
            disabled={busy}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add user
          </Button>
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

          <div className="rounded-xl border">
            <table className="w-full table-fixed text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="w-[88px] px-2 py-2 font-medium">Role</th>
                  <th className="w-[96px] px-2 py-2 font-medium">Plan</th>
                  <th className="w-[100px] px-2 py-2 font-medium">Status</th>
                  <th className="w-[150px] px-2 py-2 text-right font-medium">Credits</th>
                  <th className="hidden w-[96px] px-2 py-2 font-medium lg:table-cell">Joined</th>
                  <th className="w-[136px] px-2 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      No users match your filters.
                    </td>
                  </tr>
                ) : null}
                {filtered.map((user) => (
                  <tr key={user.user_id} className="border-b align-middle last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback
                            className={cn(
                              'text-[11px]',
                              user.role === 'admin'
                                ? 'bg-primary/15 text-primary'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {initials(user.name, user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium leading-tight">{user.name}</p>
                          <p className="truncate text-xs text-muted-foreground" title={user.email}>
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                        {user.role}
                      </Badge>
                    </td>
                    <td className="truncate px-2 py-2 capitalize" title={user.plan}>
                      {user.plan}
                    </td>
                    <td className="px-2 py-2">
                      <Badge
                        variant={user.subscription_status === 'active' ? 'default' : 'secondary'}
                        className={cn(
                          'capitalize',
                          user.subscription_status === 'suspended' &&
                            'bg-destructive/15 text-destructive hover:bg-destructive/15',
                        )}
                      >
                        {user.subscription_status}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="tabular-nums leading-tight">
                        <p>
                          {user.role === 'admin' ? '∞' : user.credits_used.toLocaleString()}
                          <span className="text-muted-foreground">
                            {user.role === 'admin' ? '' : ` / ${user.monthly_credits.toLocaleString()}`}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">+{user.topup_credits.toLocaleString()} top-up</p>
                      </div>
                    </td>
                    <td className="hidden whitespace-nowrap px-2 py-2 text-xs text-muted-foreground lg:table-cell">
                      {format(new Date(user.joined_at), 'MMM d, yy')}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={busy}
                          title="Edit role, plan, status"
                          onClick={() => setEditUser({ ...user })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={busy}
                          title="Reset / change password"
                          onClick={() => openPasswordDialog(user)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        {user.role !== 'admin' ? (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              disabled={busy}
                              title="Adjust credits"
                              onClick={() => setCreditUser(user)}
                            >
                              <Coins className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className={cn('h-8 w-8', user.suspended_at && 'text-amber-600')}
                              disabled={busy}
                              title={user.suspended_at ? 'Reactivate' : 'Suspend'}
                              onClick={() => void handleSuspend(user, !user.suspended_at)}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={busy}
                              title="Delete user"
                              onClick={() => void handleDelete(user)}
                            >
                              <Trash2 className="h-4 w-4" />
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

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (busy) return
          if (!open) setCreateForm(EMPTY_CREATE_FORM)
          setCreateOpen(open)
        }}
      >
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            The account is confirmed instantly - no email verification required.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="admin-create-email">Email</Label>
            <Input
              id="admin-create-email"
              type="email"
              autoComplete="off"
              value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="user@example.com"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="admin-create-password">Password</Label>
            <Input
              id="admin-create-password"
              type="text"
              autoComplete="new-password"
              value={createForm.password}
              onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="At least 8 characters"
            />
            <p className="text-[11px] text-muted-foreground">
              Share this with the user - they can sign in immediately.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="admin-create-name">Display name (optional)</Label>
            <Input
              id="admin-create-name"
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Defaults to the email handle"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select
                value={createForm.role}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, role: e.target.value as 'admin' | 'member' }))
                }
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Membership plan</Label>
              <Select
                value={createForm.plan}
                onChange={(e) => setCreateForm((f) => ({ ...f, plan: e.target.value }))}
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setCreateForm(EMPTY_CREATE_FORM)
              setCreateOpen(false)
            }}
          >
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => void submitCreate()}>
            {busy ? 'Creating…' : 'Create user'}
          </Button>
        </DialogFooter>
      </Dialog>

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

      <Dialog
        open={Boolean(pwUser)}
        onOpenChange={(open) => {
          if (busy) return
          if (!open) {
            setPwUser(null)
            setNewPassword('')
            setRecoveryLink('')
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Password management</DialogTitle>
          <DialogDescription>{pwUser?.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* Set a new password directly */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="h-4 w-4 text-primary" />
              Set a new password
            </div>
            <p className="text-[11px] text-muted-foreground">
              Immediately overrides the password. Share it with the user securely.
            </p>
            <div className="flex gap-2">
              <Input
                type="text"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button
                variant="outline"
                type="button"
                title="Generate a strong password"
                onClick={() => setNewPassword(generatePassword())}
              >
                Generate
              </Button>
            </div>
            <Button
              className="w-full"
              disabled={busy || newPassword.length < 8}
              onClick={() => void submitSetPassword()}
            >
              {busy ? 'Saving…' : 'Set password'}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {/* Send a self-serve recovery link */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Mail className="h-4 w-4 text-primary" />
              Send a recovery link
            </div>
            <p className="text-[11px] text-muted-foreground">
              Lets the user set their own password. Emailed automatically when SMTP is configured; the link also appears below to share manually.
            </p>
            <Button variant="outline" className="w-full" disabled={busy} onClick={() => void sendRecovery()}>
              {busy ? 'Generating…' : 'Generate recovery link'}
            </Button>
            {recoveryLink ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2">
                <code className="min-w-0 flex-1 truncate text-[11px]" title={recoveryLink}>
                  {recoveryLink}
                </code>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => void copyRecoveryLink()}>
                  {linkCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setPwUser(null)}>
            Close
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
  const bytes = new Uint32Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (n) => chars[n % chars.length]).join('')
}
