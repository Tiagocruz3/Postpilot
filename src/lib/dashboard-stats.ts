import { addHours, format, isToday, isTomorrow, parseISO } from 'date-fns'
import type { PlannerTask } from '@/types'
import type { PublishedPost } from '@/hooks/usePublishedPosts'

export type DashboardMetrics = {
  likes: number
  comments: number
  shares: number
  saves: number
  engagementTotal: number
}

export type DashboardActivityItem = {
  id: string
  text: string
  tone: 'success' | 'info' | 'warning' | 'neutral'
}

export type DashboardSuggestion = {
  id: string
  title: string
  detail: string
}

export type DashboardTopPost = {
  id: string
  title: string
  platform: string
  rateLabel: string
  rate: number
}

export type DashboardAdsSnapshot = {
  activeAds: number
  spendLabel: string
  leadsLabel: string
  cplLabel: string
  hasLiveData: boolean
}

function metricNumber(metrics: Record<string, unknown> | null, keys: string[]): number {
  if (!metrics) return 0
  for (const key of keys) {
    const value = metrics[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return 0
}

export function aggregateMetricsFromPosts(posts: PublishedPost[]): DashboardMetrics {
  let likes = 0
  let comments = 0
  let shares = 0
  let saves = 0

  for (const post of posts) {
    const metrics = (post.metrics as Record<string, unknown> | null) ?? null
    likes += metricNumber(metrics, ['likes', 'reactions'])
    comments += metricNumber(metrics, ['comments', 'replies'])
    shares += metricNumber(metrics, ['shares', 'retweets'])
    saves += metricNumber(metrics, ['saved', 'saves'])
  }

  return {
    likes,
    comments,
    shares,
    saves,
    engagementTotal: likes + comments + shares + saves,
  }
}

export function engagementRateForPost(post: PublishedPost): number {
  const metrics = (post.metrics as Record<string, unknown> | null) ?? null
  const interactions =
    metricNumber(metrics, ['likes', 'reactions']) +
    metricNumber(metrics, ['comments', 'replies']) +
    metricNumber(metrics, ['shares', 'retweets']) +
    metricNumber(metrics, ['saved', 'saves'])
  const reach = metricNumber(metrics, ['impressions', 'reach', 'engagement'])
  if (reach <= 0) {
    return interactions > 0 ? Math.min(interactions / 10, 99) : 0
  }
  return Math.min(100, (interactions / reach) * 100)
}

export function formatScheduledLabel(iso: string): string {
  const date = parseISO(iso)
  const time = format(date, 'h:mm a')
  if (isToday(date)) return `Today ${time}`
  if (isTomorrow(date)) return `Tomorrow ${time}`
  return format(date, 'EEEE')
}

export function buildActivityFeed(tasks: PlannerTask[], posts: PublishedPost[]): DashboardActivityItem[] {
  const items: DashboardActivityItem[] = []

  const publishedPosts = [...posts]
    .filter((post) => post.published_at)
    .sort((a, b) => parseISO(b.published_at!).getTime() - parseISO(a.published_at!).getTime())
    .slice(0, 2)

  for (const post of publishedPosts) {
    const platform = post.platform.replace('_', ' ')
    items.push({
      id: `pub-${post.id}`,
      text: `${platform} post published${post.title ? `: ${post.title}` : ''}`,
      tone: 'success',
    })
  }

  const commentHeavy = [...posts]
    .map((post) => ({
      post,
      comments: metricNumber((post.metrics as Record<string, unknown> | null) ?? null, ['comments', 'replies']),
    }))
    .filter((entry) => entry.comments > 0)
    .sort((a, b) => b.comments - a.comments)[0]

  if (commentHeavy) {
    items.push({
      id: `comments-${commentHeavy.post.id}`,
      text: `${commentHeavy.post.platform.replace('_', ' ')} post got ${commentHeavy.comments.toLocaleString()} comments`,
      tone: 'info',
    })
  }

  const boostedAd = tasks.find((task) => task.kind === 'ad' && task.status === 'scheduled')
  if (boostedAd) {
    items.push({
      id: `ad-${boostedAd.id}`,
      text: `${boostedAd.title} queued as an ad launch`,
      tone: 'info',
    })
  }

  const waitingDraft = tasks.find((task) => task.status === 'draft' && task.kind === 'post')
  if (waitingDraft) {
    items.push({
      id: `draft-${waitingDraft.id}`,
      text: `Draft waiting for approval: ${waitingDraft.title}`,
      tone: 'warning',
    })
  }

  if (items.length === 0) {
    items.push({
      id: 'empty',
      text: 'Create your first post to see activity here.',
      tone: 'neutral',
    })
  }

  return items.slice(0, 4)
}

export function buildAiSuggestions(tasks: PlannerTask[], posts: PublishedPost[]): DashboardSuggestion[] {
  const suggestions: DashboardSuggestion[] = []

  const upcoming = tasks
    .filter((task) => task.kind === 'post' && (task.status === 'scheduled' || task.status === 'draft'))
    .sort((a, b) => parseISO(a.scheduled_at).getTime() - parseISO(b.scheduled_at).getTime())

  if (upcoming[0]) {
    const slot = parseISO(upcoming[0].scheduled_at)
    suggestions.push({
      id: 'best-time',
      title: 'Best time to post',
      detail: format(addHours(slot, 0), 'h:mm a'),
    })
  } else {
    suggestions.push({
      id: 'best-time',
      title: 'Best time to post',
      detail: '6:30 PM on weekdays',
    })
  }

  const videoPosts = posts.filter((post) =>
    (post.media_urls ?? []).some((url) => /\.(mp4|webm|mov)(\?|$)/i.test(url)),
  )
  suggestions.push({
    id: 'format',
    title: videoPosts.length >= posts.length / 2 && posts.length > 0 ? 'Videos are winning' : 'Try more video',
    detail:
      videoPosts.length > 0
        ? 'Video posts are driving stronger engagement in your history.'
        : 'Short videos often outperform static images on social.',
  })

  const top = [...posts].sort((a, b) => engagementRateForPost(b) - engagementRateForPost(a))[0]
  if (top && engagementRateForPost(top) > 0) {
    suggestions.push({
      id: 'boost',
      title: 'Boost your top post',
      detail: `${top.title || 'Recent post'} is leading on ${top.platform.replace('_', ' ')}.`,
    })
  } else {
    suggestions.push({
      id: 'boost',
      title: 'Boost top post',
      detail: 'Turn your best organic post into a paid ad in one click.',
    })
  }

  const avgLength =
    posts.length > 0
      ? posts.reduce((sum, post) => sum + post.content.length, 0) / posts.length
      : 0
  suggestions.push({
    id: 'captions',
    title: avgLength > 220 ? 'Try shorter captions' : 'Caption length looks good',
    detail:
      avgLength > 220
        ? 'Shorter hooks may improve completion rate on feed posts.'
        : 'Keep leading with a clear hook in the first line.',
  })

  return suggestions.slice(0, 4)
}

export function buildTopPosts(posts: PublishedPost[]): DashboardTopPost[] {
  return [...posts]
    .map((post) => ({
      id: post.id,
      title: post.title || post.content.slice(0, 48) || 'Untitled post',
      platform: post.platform.replace('_', ' '),
      rate: engagementRateForPost(post),
      rateLabel: `${engagementRateForPost(post).toFixed(1)}%`,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3)
}

export function buildAdsSnapshot(tasks: PlannerTask[]): DashboardAdsSnapshot {
  const adTasks = tasks.filter((task) => task.kind === 'ad')
  const activeAds = adTasks.filter((task) => task.status === 'scheduled' || task.status === 'published').length

  if (activeAds === 0 && adTasks.length === 0) {
    return {
      activeAds: 0,
      spendLabel: ' - ',
      leadsLabel: ' - ',
      cplLabel: ' - ',
      hasLiveData: false,
    }
  }

  const estimatedSpend = activeAds * 117
  const estimatedLeads = Math.max(1, Math.round(activeAds * 16))
  const cpl = estimatedSpend / estimatedLeads

  return {
    activeAds: Math.max(activeAds, adTasks.filter((t) => t.status !== 'failed').length),
    spendLabel: `$${estimatedSpend.toLocaleString()}`,
    leadsLabel: estimatedLeads.toLocaleString(),
    cplLabel: `$${cpl.toFixed(2)}`,
    hasLiveData: false,
  }
}

export const DEMO_DASHBOARD_METRICS: DashboardMetrics = {
  likes: 2400,
  comments: 540,
  shares: 310,
  saves: 190,
  engagementTotal: 4820,
}

export const DEMO_DASHBOARD_COUNTS = {
  postsCreated: 24,
  scheduled: 12,
  published: 8,
}
