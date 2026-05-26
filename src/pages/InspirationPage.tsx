import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Eye, Plus, Sparkles } from 'lucide-react'
import { useInspirationFeed } from '@/hooks/useInspirationFeed'
import type { InspirationPost, Workspace } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ComposePlatform } from '@/lib/compose-copy'

interface OutletContext {
  currentWorkspaceId: string | null
  currentWorkspace: Workspace | null
}

export function InspirationPage() {
  const navigate = useNavigate()
  const { currentWorkspaceId, currentWorkspace } = useOutletContext<OutletContext>()
  const { watches, posts, loading, addWatch, addPost } = useInspirationFeed(currentWorkspaceId)
  const [selected, setSelected] = useState<InspirationPost | null>(null)
  const [message, setMessage] = useState('')

  const [watchHandle, setWatchHandle] = useState('')
  const [watchPlatform, setWatchPlatform] = useState<InspirationPost['platform']>('linkedin')
  const [watchNiche, setWatchNiche] = useState('')

  const [postHandle, setPostHandle] = useState('')
  const [postPlatform, setPostPlatform] = useState<InspirationPost['platform']>('linkedin')
  const [postText, setPostText] = useState('')

  const remixPost = (post: InspirationPost) => {
    navigate('/compose', {
      state: {
        remixPostText: post.post_text,
        competitorNiche: watches.find((w) => w.id === post.watch_id)?.niche ?? '',
        platform: mapToComposePlatform(post.platform),
      },
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
        <div>
          <h1 className="text-2xl font-bold">Competitor Watch</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Monitor public accounts, analyze what is working, and create original brand-safe posts inspired by trends in your niche.
            Paste posts manually for now; live account sync can be added later.
          </p>
        </div>

        {message ? <div className="rounded-2xl border bg-primary/5 px-4 py-3 text-sm">{message}</div> : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add account to watch</CardTitle>
              <CardDescription>Track handles your team cares about in this workspace.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Platform</Label>
                <Select value={watchPlatform} onChange={(e) => setWatchPlatform(e.target.value as InspirationPost['platform'])}>
                  <option value="linkedin">LinkedIn</option>
                  <option value="facebook">Facebook</option>
                  <option value="x">X</option>
                  <option value="instagram">Instagram</option>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Handle</Label>
                <Input value={watchHandle} onChange={(e) => setWatchHandle(e.target.value)} placeholder="@competitor" />
              </div>
              <div className="grid gap-1.5">
                <Label>Niche</Label>
                <Input value={watchNiche} onChange={(e) => setWatchNiche(e.target.value)} placeholder="e.g. B2B SaaS" />
              </div>
              <Button
                onClick={() => {
                  void addWatch({ platform: watchPlatform, handle: watchHandle, niche: watchNiche })
                    .then(() => {
                      setWatchHandle('')
                      setWatchNiche('')
                      setMessage('Account added to Competitor Watch.')
                    })
                    .catch((err) => setMessage(err instanceof Error ? err.message : 'Failed to add account.'))
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add account
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add post to feed</CardTitle>
              <CardDescription>Paste a public post for your team to analyze and remix.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Account</Label>
                <Input value={postHandle} onChange={(e) => setPostHandle(e.target.value)} placeholder="@competitor" />
              </div>
              <div className="grid gap-1.5">
                <Label>Platform</Label>
                <Select value={postPlatform} onChange={(e) => setPostPlatform(e.target.value as InspirationPost['platform'])}>
                  <option value="linkedin">LinkedIn</option>
                  <option value="facebook">Facebook</option>
                  <option value="x">X</option>
                  <option value="instagram">Instagram</option>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Post caption</Label>
                <Textarea value={postText} onChange={(e) => setPostText(e.target.value)} className="min-h-[100px]" />
              </div>
              <Button
                onClick={() => {
                  void addPost({ platform: postPlatform, account_handle: postHandle, post_text: postText })
                    .then(() => {
                      setPostHandle('')
                      setPostText('')
                      setMessage('Post added to Inspiration Feed.')
                    })
                    .catch((err) => setMessage(err instanceof Error ? err.message : 'Failed to add post.'))
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Save to feed
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Watched accounts</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {watches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accounts yet.</p>
            ) : (
              watches.map((watch) => (
                <Badge key={watch.id} variant="secondary">
                  {watch.platform} · @{watch.handle}
                  {watch.niche ? ` · ${watch.niche}` : ''}
                </Badge>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inspiration Feed</CardTitle>
            <CardDescription>Select a post to preview and remix.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : posts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No posts in the feed yet.</p>
            ) : (
              posts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => setSelected(post)}
                  className={`w-full rounded-2xl border p-4 text-left transition-colors hover:bg-accent/40 ${
                    selected?.id === post.id ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="mb-2 flex flex-wrap gap-2">
                    <Badge variant="outline">{post.platform}</Badge>
                    <span className="text-xs text-muted-foreground">@{post.account_handle}</span>
                  </div>
                  <p className="line-clamp-3 text-sm">{post.post_text}</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <aside className="w-full shrink-0 border-t bg-card p-6 lg:w-96 lg:border-l lg:border-t-0">
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Post preview</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              @{selected.account_handle} · {selected.platform}
            </p>
            <p className="whitespace-pre-wrap text-sm">{selected.post_text}</p>
            {selected.hashtags?.length ? (
              <p className="text-xs text-muted-foreground">{selected.hashtags.map((t) => `#${t}`).join(' ')}</p>
            ) : null}
            {selected.posted_at ? (
              <p className="text-xs text-muted-foreground">
                Posted {new Date(selected.posted_at).toLocaleString()}
              </p>
            ) : null}
            {selected.engagement && typeof selected.engagement === 'object' ? (
              <p className="text-xs text-muted-foreground">
                {Object.entries(selected.engagement as Record<string, number>)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' · ')}
              </p>
            ) : null}
            <Button className="w-full" onClick={() => remixPost(selected)}>
              <Sparkles className="mr-2 h-4 w-4" />
              Remix This Post
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Select a post from the feed to preview and remix.</p>
        )}
        <p className="mt-6 text-xs text-muted-foreground">
          Workspace: {currentWorkspace?.name ?? 'None selected'}. Inspiration data is shared with workspace members only.
        </p>
      </aside>
    </div>
  )
}

function mapToComposePlatform(platform: InspirationPost['platform']): ComposePlatform {
  if (platform === 'facebook') return 'facebook'
  if (platform === 'x') return 'x'
  return 'linkedin'
}
