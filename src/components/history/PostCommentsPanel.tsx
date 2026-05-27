import { useCallback, useEffect, useState } from 'react'
import { Loader2, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { isDemoMode } from '@/lib/demo'
import type { PublishedPost } from '@/hooks/usePublishedPosts'

export type PostComment = {
  id: string
  text: string
  author_name: string | null
  created_at: string | null
}

type PostCommentsPanelProps = {
  post: PublishedPost
  onMessage?: (message: string) => void
}

async function readInvokeError(error: unknown): Promise<string> {
  const err = error as { message?: string; context?: { json?: () => Promise<unknown> } }
  let detailed = err.message || 'Request failed.'
  if (err.context?.json) {
    try {
      const payload = (await err.context.json()) as { error?: string }
      detailed = payload?.error || detailed
    } catch {
      // ignore
    }
  }
  return detailed
}

export function PostCommentsPanel({ post, onMessage }: PostCommentsPanelProps) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<PostComment[]>([])
  const [loading, setLoading] = useState(false)
  const [replyingId, setReplyingId] = useState<string | null>(null)
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [panelError, setPanelError] = useState('')

  const canEngage = Boolean(post.platform_post_id) && !post.error

  const loadComments = useCallback(async () => {
    if (isDemoMode || !post.platform_post_id) return
    setLoading(true)
    setPanelError('')
    try {
      const { data, error } = await supabase.functions.invoke<{
        success?: boolean
        comments?: PostComment[]
        error?: string
      }>('post-engagement', {
        body: { action: 'comments', scheduled_post_id: post.id },
      })
      if (error) {
        setPanelError(await readInvokeError(error))
        setComments([])
        return
      }
      if (data?.error) {
        setPanelError(data.error)
        setComments([])
        return
      }
      setComments(data?.comments ?? [])
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : 'Could not load comments.')
      setComments([])
    } finally {
      setLoading(false)
    }
  }, [post.id, post.platform_post_id])

  useEffect(() => {
    if (open && canEngage) {
      void loadComments()
    }
  }, [open, canEngage, loadComments])

  const sendReply = async () => {
    if (isDemoMode || !replyText.trim()) return
    setSending(true)
    setPanelError('')
    try {
      const targetId = selectedCommentId || replyingId
      const { data, error } = await supabase.functions.invoke<{
        success?: boolean
        error?: string
      }>('post-engagement', {
        body: {
          action: 'reply_comment',
          scheduled_post_id: post.id,
          message: replyText.trim(),
          comment_id: targetId || undefined,
        },
      })
      if (error) {
        const msg = await readInvokeError(error)
        setPanelError(msg)
        onMessage?.(msg)
        return
      }
      if (data?.error) {
        setPanelError(data.error)
        onMessage?.(data.error)
        return
      }
      setReplyText('')
      setReplyingId(null)
      setSelectedCommentId(null)
      onMessage?.('Reply posted.')
      void loadComments()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not send reply.'
      setPanelError(msg)
      onMessage?.(msg)
    } finally {
      setSending(false)
    }
  }

  if (!canEngage) {
    return null
  }

  return (
    <div className="mt-3 rounded-xl border bg-muted/20 p-3">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="inline-flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          Comments & replies
        </span>
        <span className="text-xs text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          {panelError ? <p className="text-xs text-destructive">{panelError}</p> : null}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading comments…
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No comments yet on this post.</p>
          ) : (
            <ul className="max-h-48 space-y-2 overflow-y-auto">
              {comments.map((comment) => {
                const active = selectedCommentId === comment.id || replyingId === comment.id
                return (
                  <li
                    key={comment.id}
                    className={`rounded-lg border px-3 py-2 text-sm ${active ? 'border-primary/40 bg-primary/5' : 'bg-background'}`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{comment.author_name || 'Someone'}</span>
                      {comment.created_at ? (
                        <span>{new Date(comment.created_at).toLocaleString()}</span>
                      ) : null}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-foreground">{comment.text}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant={active ? 'default' : 'ghost'}
                      className="mt-2 h-7 px-2 text-xs"
                      onClick={() => {
                        setSelectedCommentId(comment.id)
                        setReplyingId(comment.id)
                      }}
                    >
                      Reply
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {selectedCommentId
                ? 'Replying to selected comment.'
                : post.platform === 'instagram'
                  ? 'Select a comment above to reply on Instagram.'
                  : 'Leave blank selection to reply on the post thread (Facebook, LinkedIn, X).'}
            </p>
            <Textarea
              placeholder="Write your reply…"
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
              rows={2}
              disabled={sending || (post.platform === 'instagram' && !selectedCommentId)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={
                  sending ||
                  !replyText.trim() ||
                  (post.platform === 'instagram' && !selectedCommentId)
                }
                onClick={() => void sendReply()}
              >
                {sending ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-2 h-3.5 w-3.5" />
                )}
                Send reply
              </Button>
              {selectedCommentId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedCommentId(null)
                    setReplyingId(null)
                  }}
                >
                  Clear selection
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="outline" onClick={() => void loadComments()} disabled={loading}>
                Refresh
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
