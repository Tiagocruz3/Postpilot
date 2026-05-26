import { useCallback, useEffect, useState } from 'react'
import { isDemoMode } from '@/lib/demo'
import { supabase } from '@/lib/supabase'
import type { CompetitorWatch, InspirationPost } from '@/types'

const DEMO_WATCHES: CompetitorWatch[] = [
  {
    id: 'demo-watch-1',
    workspace_id: 'demo-ws-1',
    created_by: 'demo-user-id',
    platform: 'linkedin',
    handle: 'competitor-co',
    display_name: 'Competitor Co',
    niche: 'B2B SaaS',
    created_at: new Date().toISOString(),
  },
]

const DEMO_POSTS: InspirationPost[] = [
  {
    id: 'demo-post-1',
    workspace_id: 'demo-ws-1',
    watch_id: 'demo-watch-1',
    created_by: 'demo-user-id',
    platform: 'linkedin',
    account_handle: 'competitor-co',
    post_text:
      'Most teams do not need more content. They need clearer content. Here is the 3-part framework we use before every campaign.',
    hashtags: ['marketing', 'b2b'],
    posted_at: new Date(Date.now() - 86400000).toISOString(),
    engagement: { likes: 240, comments: 18 },
    created_at: new Date().toISOString(),
  },
]

export function useInspirationFeed(workspaceId: string | null | undefined) {
  const [watches, setWatches] = useState<CompetitorWatch[]>(isDemoMode ? DEMO_WATCHES : [])
  const [posts, setPosts] = useState<InspirationPost[]>(isDemoMode ? DEMO_POSTS : [])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setWatches([])
      setPosts([])
      return
    }

    if (isDemoMode) {
      setWatches(DEMO_WATCHES)
      setPosts(DEMO_POSTS)
      return
    }

    setLoading(true)
    const [watchesRes, postsRes] = await Promise.all([
      supabase.from('workspace_competitor_watches').select('*').eq('workspace_id', workspaceId).order('created_at', {
        ascending: false,
      }),
      supabase.from('workspace_inspiration_posts').select('*').eq('workspace_id', workspaceId).order('created_at', {
        ascending: false,
      }),
    ])
    setWatches((watchesRes.data as CompetitorWatch[]) ?? [])
    setPosts((postsRes.data as InspirationPost[]) ?? [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const addWatch = useCallback(
    async (input: { platform: CompetitorWatch['platform']; handle: string; display_name?: string; niche?: string }) => {
      if (!workspaceId) return

      if (isDemoMode) {
        const row: CompetitorWatch = {
          id: `demo-${Date.now()}`,
          workspace_id: workspaceId,
          created_by: 'demo-user-id',
          platform: input.platform,
          handle: input.handle,
          display_name: input.display_name ?? input.handle,
          niche: input.niche ?? null,
          created_at: new Date().toISOString(),
        }
        setWatches((current) => [row, ...current])
        return row
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Sign in required.')
      }

      const { data, error } = await supabase
        .from('workspace_competitor_watches')
        .insert({
          workspace_id: workspaceId,
          created_by: user.id,
          platform: input.platform,
          handle: input.handle.replace(/^@/, ''),
          display_name: input.display_name ?? input.handle,
          niche: input.niche ?? null,
        } as never)
        .select()
        .single()

      if (error) {
        throw new Error(error.message)
      }
      await refresh()
      return data as CompetitorWatch
    },
    [workspaceId, refresh],
  )

  const addPost = useCallback(
    async (input: {
      platform: InspirationPost['platform']
      account_handle: string
      post_text: string
      watch_id?: string | null
      hashtags?: string[]
      posted_at?: string
      engagement?: Record<string, number>
    }) => {
      if (!workspaceId) return

      if (isDemoMode) {
        const row: InspirationPost = {
          id: `demo-post-${Date.now()}`,
          workspace_id: workspaceId,
          watch_id: input.watch_id ?? null,
          created_by: 'demo-user-id',
          platform: input.platform,
          account_handle: input.account_handle,
          post_text: input.post_text,
          hashtags: input.hashtags ?? [],
          posted_at: input.posted_at ?? null,
          engagement: input.engagement ?? {},
          created_at: new Date().toISOString(),
        }
        setPosts((current) => [row, ...current])
        return row
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Sign in required.')
      }

      const { error } = await supabase.from('workspace_inspiration_posts').insert({
        workspace_id: workspaceId,
        watch_id: input.watch_id ?? null,
        created_by: user.id,
        platform: input.platform,
        account_handle: input.account_handle.replace(/^@/, ''),
        post_text: input.post_text,
        hashtags: input.hashtags ?? [],
        posted_at: input.posted_at ?? null,
        engagement: input.engagement ?? {},
      } as never)

      if (error) {
        throw new Error(error.message)
      }
      await refresh()
    },
    [workspaceId, refresh],
  )

  return { watches, posts, loading, refresh, addWatch, addPost }
}
