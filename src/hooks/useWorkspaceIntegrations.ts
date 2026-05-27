import { useCallback, useEffect, useState } from 'react'
import { isDemoMode } from '@/lib/demo'
import { supabase } from '@/lib/supabase'
import type { IntegrationProvider, UserIntegration } from '@/types'

export interface UseWorkspaceIntegrationsResult {
  integrations: UserIntegration[]
  loading: boolean
  isConnected: (provider: IntegrationProvider | 'meta_or_facebook') => boolean
  refresh: () => Promise<void>
}

export function useWorkspaceIntegrations(workspaceId: string | null | undefined): UseWorkspaceIntegrationsResult {
  const [integrations, setIntegrations] = useState<UserIntegration[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (isDemoMode || !workspaceId) {
      setIntegrations([])
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('workspace_id', workspaceId)
    setIntegrations((data as UserIntegration[]) ?? [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => {
    setIntegrations([])
    setLoading(Boolean(workspaceId && !isDemoMode))
    void refresh()
  }, [workspaceId, refresh])

  useEffect(() => {
    if (isDemoMode || !workspaceId) {
      return
    }
    const channel = supabase
      .channel(`user_integrations_${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_integrations',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          void refresh()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [workspaceId, refresh])

  const isConnected = useCallback(
    (provider: IntegrationProvider | 'meta_or_facebook') => {
      if (isDemoMode) return true
      if (provider === 'meta_or_facebook') {
        return integrations.some((row) => row.provider === 'facebook' || row.provider === 'meta')
      }
      return integrations.some((row) => row.provider === provider)
    },
    [integrations],
  )

  return { integrations, loading, isConnected, refresh }
}
