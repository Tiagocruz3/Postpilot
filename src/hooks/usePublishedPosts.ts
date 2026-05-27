import { useCallback, useEffect, useState } from 'react'
import { isDemoMode } from '@/lib/demo'
import { supabase } from '@/lib/supabase'

export type PublishedPostMetrics = Record<string, unknown> | null

export type PublishedPost = {
  id: string
  planner_task_id: string
  platform: string
  content: string
  media_urls: string[] | null
  published_at: string | null
  permalink_url: string | null
  published_url: string | null
  preview_image_url: string | null
  platform_post_id: string | null
  metrics: PublishedPostMetrics
  metrics_updated_at: string | null
  metrics_error: string | null
  error: string | null
  created_at: string
  scheduled_at: string | null
  title: string | null
}

type RawRow = {
  id: string
  planner_task_id: string
  platform: string
  content: string
  media_urls: string[] | null
  published_at: string | null
  permalink_url: string | null
  published_url: string | null
  preview_image_url: string | null
  platform_post_id: string | null
  metrics: PublishedPostMetrics
  metrics_updated_at: string | null
  metrics_error: string | null
  error: string | null
  created_at: string
  planner_tasks?: { workspace_id: string; scheduled_at: string; title: string } | null
}

export function usePublishedPosts(workspaceId: string | null | undefined) {
  const [posts, setPosts] = useState<PublishedPost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!workspaceId || isDemoMode) {
      setPosts([])
      return
    }

    setLoading(true)
    setError(null)
    const { data, error: queryError } = await supabase
      .from('scheduled_posts')
      .select(
        'id, planner_task_id, platform, content, media_urls, published_at, permalink_url, published_url, preview_image_url, platform_post_id, metrics, metrics_updated_at, metrics_error, error, created_at, planner_tasks!inner(workspace_id, scheduled_at, title)',
      )
      .eq('planner_tasks.workspace_id', workspaceId)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (queryError) {
      setError(queryError.message)
      setPosts([])
    } else {
      const rows = (data ?? []) as unknown as RawRow[]
      const flat: PublishedPost[] = rows.map((row) => ({
        id: row.id,
        planner_task_id: row.planner_task_id,
        platform: row.platform,
        content: row.content,
        media_urls: row.media_urls,
        published_at: row.published_at,
        permalink_url: row.permalink_url,
        published_url: row.published_url,
        preview_image_url: row.preview_image_url,
        platform_post_id: row.platform_post_id,
        metrics: row.metrics,
        metrics_updated_at: row.metrics_updated_at,
        metrics_error: row.metrics_error,
        error: row.error,
        created_at: row.created_at,
        scheduled_at: row.planner_tasks?.scheduled_at ?? null,
        title: row.planner_tasks?.title ?? null,
      }))
      setPosts(flat)
    }
    setLoading(false)
  }, [workspaceId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!workspaceId || isDemoMode) return
    const channel = supabase
      .channel(`scheduled_posts_${workspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scheduled_posts' },
        () => {
          void load()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [workspaceId, load])

  const deletePost = useCallback(
    async (plannerTaskId: string) => {
      if (isDemoMode) {
        setPosts((prev) => prev.filter((post) => post.planner_task_id !== plannerTaskId))
        return
      }

      const { error: deleteError } = await supabase.from('planner_tasks').delete().eq('id', plannerTaskId)
      if (deleteError) {
        throw new Error(deleteError.message)
      }
      setPosts((prev) => prev.filter((post) => post.planner_task_id !== plannerTaskId))
    },
    [],
  )

  return { posts, loading, error, refresh: load, deletePost }
}
