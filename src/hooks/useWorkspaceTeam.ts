import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isDemoMode } from '@/lib/demo'
import type { Profile, WorkspaceInvite, WorkspaceMember, WorkspaceRole } from '@/types'

export interface WorkspaceMemberWithProfile extends WorkspaceMember {
  profile: Pick<Profile, 'display_name' | 'avatar_url'> | null
}

export function useWorkspaceTeam(workspaceId: string | null, currentUserId?: string) {
  const [members, setMembers] = useState<WorkspaceMemberWithProfile[]>([])
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadTeam = useCallback(async () => {
    if (isDemoMode || !workspaceId || !currentUserId) {
      setMembers([])
      setInvites([])
      setCanManage(true)
      return
    }

    setLoading(true)

    const [{ data: workspace }, { data: memberRows }, { data: inviteRows }] = await Promise.all([
      supabase.from('workspaces').select('owner_id').eq('id', workspaceId).single(),
      supabase.from('workspace_members').select('*').eq('workspace_id', workspaceId).order('created_at'),
      supabase.from('workspace_invites').select('*').eq('workspace_id', workspaceId).is('accepted_at', null).order('created_at'),
    ])

    const typedMembers = (memberRows ?? []) as WorkspaceMember[]
    const userIds = typedMembers.map((member) => member.user_id)
    const { data: profileRows } = userIds.length
      ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', userIds)
      : { data: [] }

    const profileMap = new Map(
      ((profileRows ?? []) as Array<Pick<Profile, 'id' | 'display_name' | 'avatar_url'>>).map((profile) => [
        profile.id,
        profile,
      ])
    )

    setMembers(
      typedMembers.map((member) => ({
        ...member,
        profile: profileMap.get(member.user_id) ?? null,
      }))
    )
    setInvites((inviteRows ?? []) as WorkspaceInvite[])

    const myMembership = typedMembers.find((member) => member.user_id === currentUserId)
    const workspaceOwnerId = (workspace as { owner_id: string } | null)?.owner_id
    setCanManage(
      workspaceOwnerId === currentUserId ||
        myMembership?.role === 'owner' ||
        myMembership?.role === 'admin'
    )
    setLoading(false)
  }, [workspaceId, currentUserId])

  useEffect(() => {
    void loadTeam()
  }, [loadTeam])

  const inviteMember = async (email: string, role: Extract<WorkspaceRole, 'admin' | 'member'>) => {
    if (!workspaceId) {
      throw new Error('No workspace selected')
    }

    const { data, error } = await supabase.functions.invoke('workspace-invite-member', {
      body: { workspace_id: workspaceId, email, role },
    })

    if (error) {
      throw new Error(error.message)
    }

    if (data?.error) {
      throw new Error(data.error as string)
    }

    await loadTeam()
    return data as { status: 'added' | 'invited'; email: string; role: string; message?: string }
  }

  const removeMember = async (userId: string) => {
    if (!workspaceId) {
      throw new Error('No workspace selected')
    }

    const { data, error } = await supabase.functions.invoke('workspace-remove-member', {
      body: { workspace_id: workspaceId, user_id: userId },
    })

    if (error) {
      throw new Error(error.message)
    }

    if (data?.error) {
      throw new Error(data.error as string)
    }

    await loadTeam()
  }

  const revokeInvite = async (inviteId: string) => {
    if (!workspaceId) {
      throw new Error('No workspace selected')
    }

    const { data, error } = await supabase.functions.invoke('workspace-remove-member', {
      body: { workspace_id: workspaceId, invite_id: inviteId },
    })

    if (error) {
      throw new Error(error.message)
    }

    if (data?.error) {
      throw new Error(data.error as string)
    }

    await loadTeam()
  }

  const deleteWorkspace = async () => {
    if (!workspaceId) {
      throw new Error('No workspace selected')
    }

    const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId)
    if (error) {
      throw error
    }
  }

  return {
    members,
    invites,
    canManage,
    loading,
    inviteMember,
    removeMember,
    revokeInvite,
    deleteWorkspace,
    reload: loadTeam,
  }
}
