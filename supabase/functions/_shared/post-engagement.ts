import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

export type PostComment = {
  id: string
  text: string
  author_name: string | null
  created_at: string | null
}

type FacebookMeta = {
  page_id?: string
  selected_page_id?: string
  pages?: Array<{ id?: string; name?: string; access_token?: string }>
}

type InstagramMeta = {
  selected_instagram_account_id?: string | null
  instagram_accounts?: Array<{ id?: string; access_token?: string }>
}

type LinkedInMeta = {
  linkedin_id?: string
  selected_profile_id?: string
  profiles?: Array<{ id?: string; author_urn?: string }>
}

function pickFacebookPage(meta: FacebookMeta) {
  const targetPageId = meta.selected_page_id || meta.page_id
  const entry = Array.isArray(meta.pages)
    ? meta.pages.find((p) => p && p.id && p.id === targetPageId)
    : undefined
  return {
    accessToken: entry?.access_token || null,
  }
}

function pickInstagramAccount(meta: InstagramMeta) {
  const accounts = Array.isArray(meta.instagram_accounts) ? meta.instagram_accounts : []
  const targetId = meta.selected_instagram_account_id || accounts[0]?.id
  return accounts.find((entry) => entry?.id && entry.id === targetId) || accounts[0] || null
}

function resolveLinkedInAuthor(meta: LinkedInMeta) {
  const selected = meta.selected_profile_id || meta.linkedin_id
  const entry = Array.isArray(meta.profiles)
    ? meta.profiles.find((profile) => profile?.id && profile.id === selected)
    : undefined
  return entry?.author_urn || (meta.linkedin_id ? `urn:li:person:${meta.linkedin_id}` : null)
}

export async function resolveScheduledPost(
  supabase: SupabaseClient,
  scheduledPostId: string,
): Promise<
  | {
      scheduled: { id: string; platform: string; platform_post_id: string; planner_task_id: string }
      workspaceId: string
    }
  | { error: string; status: number }
> {
  const { data: scheduled } = await supabase
    .from('scheduled_posts')
    .select('id, platform, platform_post_id, planner_task_id')
    .eq('id', scheduledPostId)
    .maybeSingle()

  if (!scheduled) {
    return { error: 'Post not found.', status: 404 }
  }

  const platformPostId = (scheduled as { platform_post_id?: string | null }).platform_post_id
  if (!platformPostId) {
    return { error: 'This post is not linked to a live platform post yet.', status: 400 }
  }

  const { data: task } = await supabase
    .from('planner_tasks')
    .select('workspace_id')
    .eq('id', (scheduled as { planner_task_id: string }).planner_task_id)
    .maybeSingle()

  const workspaceId = (task as { workspace_id?: string } | null)?.workspace_id
  if (!workspaceId) {
    return { error: 'Could not resolve workspace for this post.', status: 400 }
  }

  return {
    scheduled: {
      id: (scheduled as { id: string }).id,
      platform: (scheduled as { platform: string }).platform,
      platform_post_id: platformPostId,
      planner_task_id: (scheduled as { planner_task_id: string }).planner_task_id,
    },
    workspaceId,
  }
}

async function loadIntegrationToken(
  supabase: SupabaseClient,
  workspaceId: string,
  platform: string,
): Promise<{ token: string; meta: Record<string, unknown> } | { error: string }> {
  const provider = platform === 'instagram' ? 'facebook' : platform
  const { data: integration } = await supabase
    .from('user_integrations')
    .select('access_token_encrypted, metadata')
    .eq('workspace_id', workspaceId)
    .eq('provider', provider)
    .maybeSingle()

  if (!integration) {
    return { error: `Reconnect ${platform} in Settings to manage comments.` }
  }

  const meta = ((integration as { metadata?: Record<string, unknown> }).metadata ?? {}) as Record<string, unknown>
  const fallback = (integration as { access_token_encrypted?: string }).access_token_encrypted || ''

  if (platform === 'facebook') {
    const { accessToken } = pickFacebookPage(meta as FacebookMeta)
    const token = accessToken || fallback
    return token ? { token, meta } : { error: 'Facebook page token missing. Reconnect in Settings.' }
  }

  if (platform === 'instagram') {
    const account = pickInstagramAccount(meta as InstagramMeta)
    const token = account?.access_token || fallback
    return token ? { token, meta } : { error: 'Instagram token missing. Reconnect Facebook in Settings.' }
  }

  if (platform === 'linkedin' || platform === 'x') {
    return fallback ? { token: fallback, meta } : { error: `Reconnect ${platform} in Settings.` }
  }

  return { error: `Comments are not supported for ${platform}.` }
}

async function fetchFacebookComments(postId: string, token: string): Promise<PostComment[]> {
  const fields = encodeURIComponent('id,message,created_time,from{name}')
  const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(postId)}/comments?fields=${fields}&limit=25&access_token=${encodeURIComponent(token)}`
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: { message?: string } }).error?.message || `Facebook comments returned ${res.status}.`)
  }
  const items = Array.isArray((data as { data?: unknown[] }).data) ? (data as { data: unknown[] }).data : []
  return items.map((item) => {
    const row = item as { id?: string; message?: string; created_time?: string; from?: { name?: string } }
    return {
      id: row.id || '',
      text: row.message || '',
      author_name: row.from?.name ?? null,
      created_at: row.created_time ?? null,
    }
  }).filter((c) => c.id)
}

async function replyFacebookComment(commentId: string, message: string, token: string) {
  const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(commentId)}/comments`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, access_token: token }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: { message?: string } }).error?.message || `Facebook reply failed (${res.status}).`)
  }
  return { id: (data as { id?: string }).id ?? null }
}

async function fetchInstagramComments(mediaId: string, token: string): Promise<PostComment[]> {
  const fields = encodeURIComponent('id,text,timestamp,username')
  const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(mediaId)}/comments?fields=${fields}&limit=25&access_token=${encodeURIComponent(token)}`
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: { message?: string } }).error?.message || `Instagram comments returned ${res.status}.`)
  }
  const items = Array.isArray((data as { data?: unknown[] }).data) ? (data as { data: unknown[] }).data : []
  return items.map((item) => {
    const row = item as { id?: string; text?: string; timestamp?: string; username?: string }
    return {
      id: row.id || '',
      text: row.text || '',
      author_name: row.username ? `@${row.username}` : null,
      created_at: row.timestamp ?? null,
    }
  }).filter((c) => c.id)
}

async function replyInstagramComment(commentId: string, message: string, token: string) {
  const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(commentId)}/replies`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, access_token: token }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: { message?: string } }).error?.message || `Instagram reply failed (${res.status}).`)
  }
  return { id: (data as { id?: string }).id ?? null }
}

async function fetchLinkedInComments(urn: string, token: string): Promise<PostComment[]> {
  const encoded = encodeURIComponent(urn)
  const url = `https://api.linkedin.com/v2/socialActions/${encoded}/comments`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'X-Restli-Protocol-Version': '2.0.0' },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || `LinkedIn comments returned ${res.status}.`)
  }
  const elements = Array.isArray((data as { elements?: unknown[] }).elements) ? (data as { elements: unknown[] }).elements : []
  return elements.map((item) => {
    const row = item as {
      id?: string
      created?: { time?: number }
      message?: { text?: string }
      actor?: string
      commenter?: { name?: { localized?: Record<string, string> } }
    }
    const localizedName = row.commenter?.name?.localized
    const authorName = localizedName ? Object.values(localizedName)[0] : row.actor ?? null
    return {
      id: row.id || '',
      text: row.message?.text || '',
      author_name: typeof authorName === 'string' ? authorName : null,
      created_at: row.created?.time ? new Date(row.created.time).toISOString() : null,
    }
  }).filter((c) => c.id)
}

async function replyLinkedInComment(
  shareUrn: string,
  message: string,
  token: string,
  meta: Record<string, unknown>,
  parentCommentUrn?: string,
) {
  const actor = resolveLinkedInAuthor(meta as LinkedInMeta)
  if (!actor) {
    throw new Error('LinkedIn profile missing. Reconnect in Settings.')
  }
  const object = parentCommentUrn || shareUrn
  const encoded = encodeURIComponent(shareUrn)
  const url = `https://api.linkedin.com/v2/socialActions/${encoded}/comments`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      actor,
      object,
      message: { text: message },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || `LinkedIn reply failed (${res.status}).`)
  }
  return { id: (data as { id?: string }).id ?? null }
}

async function fetchXReplies(tweetId: string, token: string): Promise<PostComment[]> {
  const tweetRes = await fetch(
    `https://api.x.com/2/tweets/${encodeURIComponent(tweetId)}?tweet.fields=conversation_id`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const tweetData = await tweetRes.json().catch(() => ({}))
  const conversationId =
    (tweetData as { data?: { conversation_id?: string } }).data?.conversation_id || tweetId

  const params = new URLSearchParams({
    query: `conversation_id:${conversationId}`,
    max_results: '25',
    'tweet.fields': 'created_at,author_id,text',
    expansions: 'author_id',
    'user.fields': 'name,username',
  })
  const res = await fetch(`https://api.x.com/2/tweets/search/recent?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { detail?: string; title?: string }).detail || (data as { title?: string }).title || `X replies returned ${res.status}.`)
  }

  const users = new Map<string, { name?: string; username?: string }>()
  const includes = (data as { includes?: { users?: Array<{ id: string; name?: string; username?: string }> } }).includes
  for (const user of includes?.users ?? []) {
    users.set(user.id, user)
  }

  const tweets = Array.isArray((data as { data?: unknown[] }).data) ? (data as { data: unknown[] }).data : []
  return tweets
    .map((item) => {
      const row = item as { id?: string; text?: string; created_at?: string; author_id?: string }
      if (!row.id || row.id === tweetId) return null
      const user = row.author_id ? users.get(row.author_id) : undefined
      const authorName = user?.name || (user?.username ? `@${user.username}` : null)
      return {
        id: row.id,
        text: row.text || '',
        author_name: authorName,
        created_at: row.created_at ?? null,
      }
    })
    .filter((c): c is PostComment => Boolean(c))
}

async function replyXTweet(inReplyToId: string, message: string, token: string) {
  const res = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message, reply: { in_reply_to_tweet_id: inReplyToId } }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !(data as { data?: { id?: string } }).data?.id) {
    throw new Error((data as { detail?: string; title?: string }).detail || (data as { title?: string }).title || `X reply failed (${res.status}).`)
  }
  return { id: (data as { data: { id: string } }).data.id }
}

export async function listPostComments(
  supabase: SupabaseClient,
  scheduledPostId: string,
): Promise<{ comments: PostComment[] } | { error: string }> {
  const resolved = await resolveScheduledPost(supabase, scheduledPostId)
  if ('error' in resolved) return { error: resolved.error }

  const { scheduled, workspaceId } = resolved
  const auth = await loadIntegrationToken(supabase, workspaceId, scheduled.platform)
  if ('error' in auth) return { error: auth.error }

  try {
    let comments: PostComment[] = []
    if (scheduled.platform === 'facebook') {
      comments = await fetchFacebookComments(scheduled.platform_post_id, auth.token)
    } else if (scheduled.platform === 'instagram') {
      comments = await fetchInstagramComments(scheduled.platform_post_id, auth.token)
    } else if (scheduled.platform === 'linkedin') {
      comments = await fetchLinkedInComments(scheduled.platform_post_id, auth.token)
    } else if (scheduled.platform === 'x') {
      comments = await fetchXReplies(scheduled.platform_post_id, auth.token)
    } else {
      return { error: `Comments are not supported for ${scheduled.platform}.` }
    }
    return { comments }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not load comments.' }
  }
}

export async function replyToPostComment(
  supabase: SupabaseClient,
  scheduledPostId: string,
  message: string,
  commentId?: string,
): Promise<{ reply_id: string | null } | { error: string }> {
  const trimmed = message.trim()
  if (!trimmed) return { error: 'Reply message is required.' }

  const resolved = await resolveScheduledPost(supabase, scheduledPostId)
  if ('error' in resolved) return { error: resolved.error }

  const { scheduled, workspaceId } = resolved
  const auth = await loadIntegrationToken(supabase, workspaceId, scheduled.platform)
  if ('error' in auth) return { error: auth.error }

  try {
    let result: { id: string | null } = { id: null }
    if (scheduled.platform === 'facebook') {
      const targetId = commentId || scheduled.platform_post_id
      result = await replyFacebookComment(targetId, trimmed, auth.token)
    } else if (scheduled.platform === 'instagram') {
      if (!commentId) return { error: 'Select a comment to reply on Instagram.' }
      result = await replyInstagramComment(commentId, trimmed, auth.token)
    } else if (scheduled.platform === 'linkedin') {
      result = await replyLinkedInComment(
        scheduled.platform_post_id,
        trimmed,
        auth.token,
        auth.meta,
        commentId,
      )
    } else if (scheduled.platform === 'x') {
      const targetId = commentId || scheduled.platform_post_id
      result = await replyXTweet(targetId, trimmed, auth.token)
    } else {
      return { error: `Replies are not supported for ${scheduled.platform}.` }
    }
    return { reply_id: result.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not send reply.' }
  }
}
