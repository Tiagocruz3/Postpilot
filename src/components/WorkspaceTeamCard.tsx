import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Trash2, UserPlus, Users } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useWorkspaceTeam } from '@/hooks/useWorkspaceTeam'
import { getInitials } from '@/lib/user-preferences'
import type { WorkspaceRole } from '@/types'

interface WorkspaceTeamCardProps {
  workspaceId: string | null
  workspaceName?: string
  currentUserId?: string
  isWorkspaceOwner?: boolean
  onWorkspaceDeleted?: () => void
}

export function WorkspaceTeamCard({
  workspaceId,
  workspaceName,
  currentUserId,
  isWorkspaceOwner,
  onWorkspaceDeleted,
}: WorkspaceTeamCardProps) {
  const navigate = useNavigate()
  const { members, invites, canManage, loading, inviteMember, removeMember, revokeInvite, deleteWorkspace } =
    useWorkspaceTeam(workspaceId, currentUserId)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Extract<WorkspaceRole, 'admin' | 'member'>>('member')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!email.trim()) {
      return
    }

    setBusy(true)
    setMessage('')
    try {
      const result = await inviteMember(email.trim(), role)
      setEmail('')
      setMessage(
        result.status === 'added'
          ? `${result.email} was added to this workspace.`
          : result.message ?? `Invite sent to ${result.email}.`
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to invite member')
    } finally {
      setBusy(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    setBusy(true)
    setMessage('')
    try {
      await removeMember(userId)
      setMessage('Member removed from workspace.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to remove member')
    } finally {
      setBusy(false)
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    setBusy(true)
    setMessage('')
    try {
      await revokeInvite(inviteId)
      setMessage('Invite removed.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to remove invite')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteWorkspace = async () => {
    if (!workspaceName) {
      return
    }

    const confirmed = window.confirm(
      `Delete "${workspaceName}"? This removes all members, invites, and workspace data. This cannot be undone.`
    )
    if (!confirmed) {
      return
    }

    setBusy(true)
    setMessage('')
    try {
      await deleteWorkspace()
      localStorage.removeItem('current_workspace_id')
      onWorkspaceDeleted?.()
      navigate('/')
      window.location.reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete workspace')
      setBusy(false)
    }
  }

  if (!workspaceId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>Select a workspace to manage seats and members.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Team & seats
          </CardTitle>
          <CardDescription>
            The person who creates a workspace is the <strong>owner</strong>. Owners and admins can invite people by
            email. If they already have an account they join immediately; otherwise they join when they sign up.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {message ? <p className="rounded-2xl border bg-primary/5 px-4 py-3 text-sm">{message}</p> : null}

          {canManage ? (
            <form onSubmit={handleInvite} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px_auto] md:items-end">
              <div className="grid gap-2">
                <Label htmlFor="invite-email">Email address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select
                  id="invite-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as Extract<WorkspaceRole, 'admin' | 'member'>)}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </Select>
              </div>
              <Button type="submit" disabled={busy}>
                <UserPlus className="mr-2 h-4 w-4" />
                {busy ? 'Sending…' : 'Add seat'}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Only workspace owners and admins can invite teammates.</p>
          )}

          <div className="space-y-3">
            <p className="text-sm font-medium">Members ({members.length})</p>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading team…</p>
            ) : (
              <div className="space-y-2">
                {members.map((member) => {
                  const label = member.profile?.display_name || `User ${member.user_id.slice(0, 8)}`
                  const isOwner = member.role === 'owner'
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-2xl border bg-background px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={member.profile?.avatar_url ?? undefined} />
                          <AvatarFallback>{getInitials(label)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-xs capitalize text-muted-foreground">{member.role}</p>
                        </div>
                      </div>
                      {canManage && !isOwner && member.user_id !== currentUserId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void handleRemoveMember(member.user_id)}
                        >
                          <Trash2 className="mr-2 h-3 w-3" />
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {invites.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">Pending invites ({invites.length})</p>
              <div className="space-y-2">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between rounded-2xl border border-dashed bg-muted/20 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{invite.email}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {invite.role} · waiting to sign up
                        </p>
                      </div>
                    </div>
                    {canManage ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void handleRevokeInvite(invite.id)}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {isWorkspaceOwner ? (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Delete duplicate or test workspaces you no longer need. You have several from earlier setup attempts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" disabled={busy} onClick={() => void handleDeleteWorkspace()}>
              Delete &quot;{workspaceName}&quot;
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
