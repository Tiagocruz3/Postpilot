import { useMemo } from 'react'
import { isAfter, parseISO } from 'date-fns'
import { isDemoMode } from '@/lib/demo'
import { shouldUseDemoDashboardSeed } from '@/lib/workspace-scope'
import {
  aggregateMetricsFromPosts,
  buildActivityFeed,
  buildAdsSnapshot,
  buildAiSuggestions,
  buildTopPosts,
  DEMO_DASHBOARD_COUNTS,
  DEMO_DASHBOARD_METRICS,
} from '@/lib/dashboard-stats'
import { usePlannerTasks } from '@/hooks/usePlannerTasks'
import { usePublishedPosts } from '@/hooks/usePublishedPosts'
import type { PlannerTask } from '@/types'

export function useDashboardData(workspaceId: string | null | undefined) {
  const { tasks, loading: tasksLoading } = usePlannerTasks(workspaceId || undefined)
  const { posts, loading: postsLoading } = usePublishedPosts(workspaceId)

  const data = useMemo(() => {
    const postTasks = tasks.filter((task) => task.kind === 'post')
    const now = new Date()

    const postsCreated = postTasks.length
    const scheduled = tasks.filter((task) => task.status === 'scheduled').length
    const published = tasks.filter((task) => task.status === 'published').length

    const metricsFromPosts = aggregateMetricsFromPosts(posts)
    const useDemoMetrics =
      isDemoMode &&
      shouldUseDemoDashboardSeed(workspaceId) &&
      metricsFromPosts.engagementTotal === 0 &&
      posts.length === 0

    const metrics = useDemoMetrics ? DEMO_DASHBOARD_METRICS : metricsFromPosts
    const counts = useDemoMetrics
      ? DEMO_DASHBOARD_COUNTS
      : { postsCreated, scheduled, published }

    const upcomingScheduled = tasks
      .filter(
        (task) =>
          (task.kind === 'post' || task.kind === 'ad') &&
          isAfter(parseISO(task.scheduled_at), now),
      )
      .sort((a, b) => parseISO(a.scheduled_at).getTime() - parseISO(b.scheduled_at).getTime())
      .slice(0, 8)

    return {
      counts: {
        postsCreated: counts.postsCreated,
        scheduled: counts.scheduled,
        published: counts.published,
        engagement: metrics.engagementTotal,
      },
      metrics,
      activity: buildActivityFeed(tasks, posts),
      suggestions: buildAiSuggestions(tasks, posts),
      upcomingScheduled,
      topPosts: buildTopPosts(posts),
      ads: buildAdsSnapshot(tasks),
    }
  }, [tasks, posts, workspaceId])

  return {
    ...data,
    loading: tasksLoading || postsLoading,
    tasks,
  }
}

export type DashboardScheduledRow = PlannerTask
