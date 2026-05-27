import { useCallback, useEffect, useState } from 'react'
import { isDemoMode } from '@/lib/demo'
import { supabase } from '@/lib/supabase'
import type { WorkspaceAiMedia } from '@/types'

export type AiMediaTab = 'image' | 'video'

const DEMO_MEDIA: WorkspaceAiMedia[] = [
  {
    id: 'demo-image-1',
    workspace_id: 'demo-ws-1',
    created_by: 'demo-user-id',
    media_type: 'image',
    storage_bucket: 'ai_library',
    storage_path: 'demo/image.png',
    public_url: 'https://placehold.co/800x800?text=Demo+AI+Image',
    prompt: 'Demo workspace image',
    source: 'compose',
    metadata: {},
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-video-1',
    workspace_id: 'demo-ws-1',
    created_by: 'demo-user-id',
    media_type: 'video',
    storage_bucket: 'ai_library',
    storage_path: 'demo/video.mp4',
    public_url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    prompt: 'Demo workspace video',
    source: 'compose',
    metadata: {},
    created_at: new Date().toISOString(),
  },
]

export function useAiMediaLibrary(workspaceId: string | null | undefined) {
  const [items, setItems] = useState<WorkspaceAiMedia[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setItems([])
      setLoading(false)
      setError(null)
      return
    }

    if (isDemoMode) {
      setItems(DEMO_MEDIA.filter((item) => item.workspace_id === workspaceId))
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('workspace_ai_media')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (queryError) {
      setError(queryError.message)
      setItems([])
    } else {
      setItems((data as WorkspaceAiMedia[]) ?? [])
    }

    setLoading(false)
  }, [workspaceId])

  useEffect(() => {
    setItems([])
    setError(null)
    if (!workspaceId) {
      setLoading(false)
      return
    }
    setLoading(!isDemoMode)
    void refresh()
  }, [workspaceId, refresh])

  useEffect(() => {
    if (isDemoMode || !workspaceId) {
      return
    }
    const channel = supabase
      .channel(`workspace_ai_media_changes_${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_ai_media',
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

  useEffect(() => {
    if (isDemoMode || !workspaceId || typeof window === 'undefined') {
      return
    }
    const handleFocus = () => {
      void refresh()
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [workspaceId, refresh])

  const remove = useCallback(
    async (id: string) => {
      if (isDemoMode) {
        setItems((current) => current.filter((item) => item.id !== id))
        return
      }

      const target = items.find((item) => item.id === id)
      if (!target) {
        return
      }

      const isExternalFallback = target.storage_bucket === 'external_ai'
      if (!isExternalFallback) {
        const { error: storageError } = await supabase.storage.from(target.storage_bucket).remove([target.storage_path])
        if (storageError) {
          throw new Error(storageError.message)
        }
      }

      const { error: deleteError } = await supabase.from('workspace_ai_media').delete().eq('id', id)
      if (deleteError) {
        throw new Error(deleteError.message)
      }

      setItems((current) => current.filter((item) => item.id !== id))
    },
    [items],
  )

  return { items, loading, error, refresh, remove }
}
