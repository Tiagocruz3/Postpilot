import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Workspace } from '@/types'
import { isDemoMode, demoWorkspaces } from '@/lib/demo'
import type { Database } from '@/types/database'

type WorkspaceInsert = Database['public']['Tables']['workspaces']['Insert']
type WorkspaceMemberInsert = Database['public']['Tables']['workspace_members']['Insert']

export function useWorkspaces(userId?: string) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(isDemoMode ? demoWorkspaces : [])
  const [loading, setLoading] = useState(!isDemoMode)

  useEffect(() => {
    if (isDemoMode) {
      return
    }

    let active = true

    const fetchWorkspaces = async () => {
      if (!userId) {
        if (active) {
          setWorkspaces([])
          setLoading(false)
        }
        return
      }

      setLoading(true)

      const { data: memberData } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId)

      if (!active) {
        return
      }

      if (!memberData?.length) {
        setWorkspaces([])
        setLoading(false)
        return
      }

      const ids = (memberData as Array<{ workspace_id: string }>).map((member) => member.workspace_id)
      const { data: wsData } = await supabase
        .from('workspaces')
        .select('*')
        .in('id', ids)
        .order('created_at', { ascending: true })

      if (!active) {
        return
      }

      setWorkspaces((wsData as Workspace[]) ?? [])
      setLoading(false)
    }

    void fetchWorkspaces()

    return () => {
      active = false
    }
  }, [userId])

  const createWorkspace = async (name: string) => {
    if (isDemoMode) {
      const ws: Workspace = {
        id: `demo-ws-${Date.now()}`,
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        owner_id: 'demo-user-id',
        created_at: new Date().toISOString(),
      }
      setWorkspaces((prev) => [...prev, ws])
      return ws
    }

    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const workspacePayload: WorkspaceInsert = { name, slug, owner_id: userId! }
    const { data, error } = await (supabase
      .from('workspaces')
      .insert(workspacePayload as never)
      .select()
      .single())

    if (error) throw error

    const workspace = data as Workspace
    const membershipPayload: WorkspaceMemberInsert = {
      workspace_id: workspace.id,
      user_id: userId!,
      role: 'owner',
    }
    await supabase.from('workspace_members').insert(membershipPayload as never)

    setWorkspaces((prev) => [...prev, workspace])
    return workspace
  }

  return { workspaces, loading, createWorkspace }
}
