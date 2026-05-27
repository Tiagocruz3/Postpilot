import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  RefreshCw,
  Repeat2,
  Send,
  Share2,
  Trash2,
  XCircle,
} from 'lucide-react'
import { PostCommentsPanel } from '@/components/history/PostCommentsPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import type { Workspace } from '@/types'
import { APP_PAGE } from '@/lib/app-labels'
import { usePublishedPosts, type PublishedPost } from '@/hooks/usePublishedPosts'
import { supabase } from '@/lib/supabase'
import { isDemoMode } from '@/lib/demo'

interface OutletContext {
  currentWorkspaceId: string | null
  currentWorkspace: Workspace | null
}

const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  x: 'X',
}

function platformLabel(platform: string): string {
  return PLATFORM_LABEL[platform] ?? platform
}

function pickMetricsLabel(platform: string): { label: string; icon: typeof Heart }[] {
  if (platform === 'instagram') {
    return [
      { label: 'likes', icon: Heart },
      { label: 'comments', icon: MessageCircle },
      { label: 'saved', icon: Repeat2 },
      { label: 'reach', icon: Eye },
      { label: 'impressions', icon: Eye },
    ]
  }
  if (platform === 'linkedin') {
    return [
      { label: 'likes', icon: Heart },
      { label: 'comments', icon: MessageCircle },
    ]
  }
  if (platform === 'x') {
    return [
      { label: 'likes', icon: Heart },
      { label: 'replies', icon: MessageCircle },
      { label: 'retweets', icon: Repeat2 },
      { label: 'impressions', icon: Eye },
    ]
  }
  return [
    { label: 'reactions', icon: Heart },
    { label: 'comments', icon: MessageCircle },
    { label: 'shares', icon: Share2 },
    { label: 'impressions', icon: Eye },
    { label: 'video_views', icon: Eye },
  ]
}

function readMetric(metrics: Record<string, unknown> | null, key: string): string {
  if (!metrics) return '-'
  const value = metrics[key]
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number') return value.toLocaleString()
  return String(value)
}

function statusFor(post: PublishedPost): 'published' | 'failed' | 'pending' {
  if (post.error) return 'failed'
  if (post.published_at) return 'published'
  return 'pending'
}

export function HistoryPage() {
  const { currentWorkspaceId } = useOutletContext<OutletContext>()
  const { posts, loading, error, refresh, deletePost } = usePublishedPosts(currentWorkspaceId)
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [refreshMessage, setRefreshMessage] = useState<string>('')

  const filtered = useMemo(() => {
    return posts.filter((post) => {
      if (platformFilter !== 'all' && post.platform !== platformFilter) return false
      const postStatus = statusFor(post)
      if (statusFilter !== 'all' && postStatus !== statusFilter) return false
      if (query.trim() && !post.content.toLowerCase().includes(query.trim().toLowerCase())) return false
      return true
    })
  }, [posts, platformFilter, statusFilter, query])

  const publishedCount = posts.filter((p) => statusFor(p) === 'published').length
  const failedCount = posts.filter((p) => statusFor(p) === 'failed').length
  const totalImpressions = posts.reduce((acc, post) => {
    const metrics = post.metrics as Record<string, unknown> | null
    const value = metrics?.impressions ?? metrics?.reach
    return acc + (typeof value === 'number' ? value : 0)
  }, 0)

  const retryPublish = async (post: PublishedPost) => {
    if (isDemoMode) return
    setRetryingId(post.id)
    setRefreshMessage('')
    try {
      await supabase
        .from('scheduled_posts')
        .update({ error: null } as never)
        .eq('id', post.id)
      await supabase
        .from('planner_tasks')
        .update({ status: 'scheduled' } as never)
        .eq('id', post.planner_task_id)

      const { data, error: invokeError } = await supabase.functions.invoke<{
        success?: boolean
        error?: string
        permalink_url?: string | null
      }>(`${post.platform}-api`, {
        body: {
          task_id: post.planner_task_id,
          content: post.content,
          media_urls: post.media_urls ?? [],
        },
      })
      if (invokeError) {
        const context = (invokeError as { context?: { json?: () => Promise<unknown> } }).context
        let detailed = invokeError.message
        if (context?.json) {
          try {
            const payload = (await context.json()) as { error?: string }
            detailed = payload?.error || detailed
          } catch {
            // ignore
          }
        }
        setRefreshMessage(detailed || `Retry failed on ${platformLabel(post.platform)}.`)
      } else if (data?.error) {
        setRefreshMessage(data.error)
      } else if (data?.permalink_url) {
        setRefreshMessage(`Republished. View on ${platformLabel(post.platform)}.`)
      } else {
        setRefreshMessage('Republished. Refreshing list...')
      }
      void refresh()
    } catch (err) {
      setRefreshMessage(err instanceof Error ? err.message : 'Retry failed.')
    } finally {
      setRetryingId(null)
    }
  }

  const removePost = async (post: PublishedPost) => {
    if (isDemoMode) return
    const label = statusFor(post) === 'published' ? 'published post' : statusFor(post) === 'failed' ? 'failed post' : 'post'
    const confirmed = window.confirm(
      `Remove this ${label} from history? This deletes the planner entry locally; it does not delete the live post on ${platformLabel(post.platform)}.`,
    )
    if (!confirmed) return

    setDeletingId(post.id)
    setRefreshMessage('')
    try {
      await deletePost(post.planner_task_id)
      setRefreshMessage('Post removed from history.')
    } catch (err) {
      setRefreshMessage(err instanceof Error ? err.message : 'Could not remove post.')
    } finally {
      setDeletingId(null)
    }
  }

  const refreshMetrics = async (post: PublishedPost) => {
    if (isDemoMode || !post.platform_post_id) return
    setRefreshingId(post.id)
    setRefreshMessage('')
    try {
      const fn = `${post.platform}-api`
      const { data, error: invokeError } = await supabase.functions.invoke<{ success?: boolean; error?: string }>(fn, {
        body: { action: 'metrics', scheduled_post_id: post.id },
      })
      if (invokeError) {
        const context = (invokeError as { context?: { json?: () => Promise<unknown> } }).context
        let detailed = invokeError.message
        if (context?.json) {
          try {
            const payload = (await context.json()) as { error?: string }
            detailed = payload?.error || detailed
          } catch {
            // ignore
          }
        }
        setRefreshMessage(detailed || `Could not refresh metrics for ${platformLabel(post.platform)}.`)
      } else if (data?.error) {
        setRefreshMessage(data.error)
      } else {
        setRefreshMessage('Metrics refreshed.')
        void refresh()
      }
    } catch (err) {
      setRefreshMessage(err instanceof Error ? err.message : 'Could not refresh metrics.')
    } finally {
      setRefreshingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 alive-enter">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{APP_PAGE.activityLog}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every post published from {APP_PAGE.createStudio}, with live links and engagement metrics from each platform.
          </p>
        </div>
        <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Reload
        </Button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{publishedCount}</p>
              <p className="text-xs text-muted-foreground">Published</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <div className="rounded-xl bg-destructive/10 p-2 text-destructive">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{failedCount}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalImpressions.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total impressions / reach</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-5">
            <div className="rounded-xl bg-violet-100 p-2 text-violet-600">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{posts.length}</p>
              <p className="text-xs text-muted-foreground">Total posts</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Posts</CardTitle>
          <CardDescription>Filter by platform, status, or search post content.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Select value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)}>
              <option value="all">All platforms</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="linkedin">LinkedIn</option>
              <option value="x">X</option>
            </Select>
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="published">Published</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </Select>
            <Input
              placeholder="Search post content"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          {refreshMessage ? (
            <p className="rounded-xl border bg-muted/40 px-3 py-2 text-sm">{refreshMessage}</p>
          ) : null}
          {error ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              {posts.length === 0
                ? `Nothing published yet. Send a post from ${APP_PAGE.createStudio} and it will appear here.`
                : 'No posts match these filters.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((post) => {
                const postStatus = statusFor(post)
                const metricsRows = pickMetricsLabel(post.platform)
                const metricsRecord = (post.metrics as Record<string, unknown> | null) ?? null
                const livePostUrl = post.permalink_url || post.published_url
                const refreshing = refreshingId === post.id

                return (
                  <div
                    key={post.id}
                    className="rounded-2xl border bg-background p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex flex-wrap items-start gap-4">
                      {post.preview_image_url ? (
                        <img
                          src={post.preview_image_url}
                          alt=""
                          className="h-20 w-20 shrink-0 rounded-xl border object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border bg-muted text-xs text-muted-foreground">
                          No media
                        </div>
                      )}

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{platformLabel(post.platform)}</Badge>
                          <Badge
                            variant={
                              postStatus === 'published'
                                ? 'default'
                                : postStatus === 'failed'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {postStatus}
                          </Badge>
                          {post.published_at ? (
                            <span className="text-xs text-muted-foreground">
                              Published {new Date(post.published_at).toLocaleString()}
                            </span>
                          ) : post.scheduled_at ? (
                            <span className="text-xs text-muted-foreground">
                              Scheduled {new Date(post.scheduled_at).toLocaleString()}
                            </span>
                          ) : null}
                        </div>

                        <p className="line-clamp-3 whitespace-pre-wrap text-sm text-foreground">{post.content}</p>

                        {post.error ? (
                          <p className="text-xs text-destructive">Publish error: {post.error}</p>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-2">
                          {livePostUrl ? (
                            <a
                              href={livePostUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View on {platformLabel(post.platform)}
                            </a>
                          ) : null}
                          {postStatus === 'failed' ? (
                            <Button
                              size="sm"
                              variant="default"
                              disabled={retryingId === post.id}
                              onClick={() => void retryPublish(post)}
                            >
                              {retryingId === post.id ? (
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Send className="mr-2 h-3.5 w-3.5" />
                              )}
                              Retry publish
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={refreshing || !post.platform_post_id}
                            onClick={() => void refreshMetrics(post)}
                            title={!post.platform_post_id ? 'No platform post id stored.' : undefined}
                          >
                            {refreshing ? (
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-2 h-3.5 w-3.5" />
                            )}
                            Refresh metrics
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10"
                            disabled={deletingId === post.id}
                            onClick={() => void removePost(post)}
                          >
                            {deletingId === post.id ? (
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                            )}
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-3 text-xs sm:grid-cols-5">
                      {metricsRows.map((row) => {
                        const Icon = row.icon
                        return (
                          <div key={row.label} className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="capitalize text-muted-foreground">{row.label.replace('_', ' ')}</span>
                            <span className="ml-auto font-medium text-foreground">
                              {readMetric(metricsRecord, row.label)}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {post.metrics_updated_at ? (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Metrics updated {new Date(post.metrics_updated_at).toLocaleString()}
                        {post.metrics_error ? ` · ${post.metrics_error}` : ''}
                      </p>
                    ) : null}

                    <PostCommentsPanel post={post} onMessage={setRefreshMessage} />
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
