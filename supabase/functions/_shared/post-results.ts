import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

export type PublishedPostUpdate = {
  task_id: string
  status?: 'published' | 'failed'
  platform_post_id?: string | null
  published_url?: string | null
  permalink_url?: string | null
  preview_image_url?: string | null
  error_message?: string | null
}

export type PublishedScheduledPost = {
  id: string
  platform: string
  permalink_url: string | null
  published_url: string | null
  preview_image_url: string | null
  platform_post_id: string | null
  metrics: Record<string, unknown>
}

export async function recordPublishResult(
  supabase: SupabaseClient,
  input: PublishedPostUpdate,
): Promise<PublishedScheduledPost | null> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.status === 'published') {
    updates.published_at = new Date().toISOString()
  }

  if (input.published_url !== undefined) updates.published_url = input.published_url
  if (input.permalink_url !== undefined) updates.permalink_url = input.permalink_url
  if (input.preview_image_url !== undefined) updates.preview_image_url = input.preview_image_url
  if (input.platform_post_id !== undefined) updates.platform_post_id = input.platform_post_id
  if (input.error_message !== undefined) updates.error = input.error_message

  delete updates.updated_at // scheduled_posts has no updated_at column

  await supabase
    .from('planner_tasks')
    .update({ status: input.status ?? 'published' })
    .eq('id', input.task_id)

  const { data, error } = await supabase
    .from('scheduled_posts')
    .update(updates)
    .eq('planner_task_id', input.task_id)
    .select(
      'id, platform, permalink_url, published_url, preview_image_url, platform_post_id, metrics',
    )
    .maybeSingle()

  if (error) {
    console.error('recordPublishResult update error:', error)
    return null
  }

  return (data as PublishedScheduledPost | null) ?? null
}

export async function updatePostMetrics(
  supabase: SupabaseClient,
  scheduledPostId: string,
  metrics: Record<string, unknown>,
  metricsError: string | null = null,
) {
  await supabase
    .from('scheduled_posts')
    .update({
      metrics,
      metrics_updated_at: new Date().toISOString(),
      metrics_error: metricsError,
    })
    .eq('id', scheduledPostId)
}
