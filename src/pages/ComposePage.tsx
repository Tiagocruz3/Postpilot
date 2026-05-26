import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Calendar, Image, Link, Send } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { isDemoMode } from '@/lib/demo'
import { redirectToEdgeFunction, supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { Database } from '@/types/database'

interface OutletContext {
  currentWorkspaceId: string | null
}

type SocialPlatform = 'facebook' | 'linkedin' | 'x'
type PlannerTaskInsert = Database['public']['Tables']['planner_tasks']['Insert']
type ScheduledPostInsert = Database['public']['Tables']['scheduled_posts']['Insert']

const MAX_CHARS: Record<SocialPlatform, number> = {
  facebook: 63206,
  linkedin: 3000,
  x: 280,
}

export function ComposePage() {
  const { currentWorkspaceId } = useOutletContext<OutletContext>()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<SocialPlatform>('facebook')
  const [content, setContent] = useState('')
  const [media, setMedia] = useState<string[]>([])
  const [linkUrl, setLinkUrl] = useState('')
  const [scheduleAt, setScheduleAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const maxChars = MAX_CHARS[activeTab]
  const charCount = content.length

  const connect = (provider: SocialPlatform) => {
    if (isDemoMode) {
      setMessage(`Demo mode: ${platformLabel(provider)} connected.`)
      return
    }

    redirectToEdgeFunction(`${provider}-oauth-start`, { workspace_id: currentWorkspaceId })
  }

  const publish = async (action: 'now' | 'schedule') => {
    if (!currentWorkspaceId) return

    setLoading(true)
    setMessage('')

    try {
      if (isDemoMode) {
        setMessage(`Demo mode: ${action === 'now' ? 'posted' : 'scheduled'} to ${platformLabel(activeTab)}.`)
        resetForm()
        return
      }

      if (!user?.id) {
        throw new Error('You need to be signed in to create a post.')
      }

      const plannerTask: PlannerTaskInsert = {
        user_id: user.id,
        workspace_id: currentWorkspaceId,
        title: content.slice(0, 60) || `${platformLabel(activeTab)} post`,
        description: content,
        scheduled_at: action === 'now' ? new Date().toISOString() : scheduleAt || new Date().toISOString(),
        duration_minutes: 15,
        status: 'scheduled',
        kind: 'post',
        platform: activeTab,
        payload: { media_urls: media, link_url: linkUrl },
      }

      const taskRes = await supabase.from('planner_tasks').insert(plannerTask as never).select().single()
      if (taskRes.error) throw taskRes.error

      const createdTask = taskRes.data as { id: string }
      const scheduledPost: ScheduledPostInsert = {
        planner_task_id: createdTask.id,
        platform: activeTab,
        content,
        media_urls: media.length ? media : null,
      }

      const scheduledPostRes = await supabase.from('scheduled_posts').insert(scheduledPost as never)
      if (scheduledPostRes.error) throw scheduledPostRes.error

      if (action === 'now') {
        await supabase.functions.invoke(`${activeTab}-api`, {
          body: { task_id: createdTask.id, content, media_urls: media },
        })
      }

      setMessage(`${action === 'now' ? 'Posted' : 'Scheduled'} to ${platformLabel(activeTab)}.`)
      resetForm()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save this post right now.')
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (isDemoMode) {
      const url = URL.createObjectURL(file)
      setMedia((prev) => [...prev, url])
      return
    }

    if (!currentWorkspaceId) {
      return
    }

    const path = `${currentWorkspaceId}/${Date.now()}_${file.name}`
    const { data, error } = await supabase.storage.from('media').upload(path, file)
    if (!error && data) {
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(data.path)
      setMedia((prev) => [...prev, urlData.publicUrl])
    }
  }

  function resetForm() {
    setContent('')
    setMedia([])
    setLinkUrl('')
    setScheduleAt('')
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Compose</h1>
        <p className="mt-1 text-sm text-muted-foreground">Draft Facebook, LinkedIn, and X posts with shared scheduling controls.</p>
      </div>

      {message ? (
        <div className="mb-4 rounded-2xl border bg-primary/5 px-4 py-3 text-sm text-foreground">
          {message}
        </div>
      ) : null}

      <Tabs>
        <TabsList className="mb-4">
          <TabsTrigger value="facebook" activeValue={activeTab} onClick={(value) => setActiveTab(value as SocialPlatform)}>
            Facebook
          </TabsTrigger>
          <TabsTrigger value="linkedin" activeValue={activeTab} onClick={(value) => setActiveTab(value as SocialPlatform)}>
            LinkedIn
          </TabsTrigger>
          <TabsTrigger value="x" activeValue={activeTab} onClick={(value) => setActiveTab(value as SocialPlatform)}>
            X
          </TabsTrigger>
        </TabsList>

        {(['facebook', 'linkedin', 'x'] as const).map((platform) => (
          <TabsContent key={platform} value={platform} activeValue={activeTab}>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">{platformLabel(platform)} composer</CardTitle>
                <Button size="sm" variant="outline" onClick={() => connect(platform)}>
                  Connect {platformLabel(platform)}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Textarea
                    placeholder="What's on your mind?"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    className="min-h-[180px] resize-none"
                  />
                  <div className="absolute bottom-3 right-3">
                    <Badge variant={charCount > maxChars ? 'destructive' : 'secondary'}>
                      {charCount}/{maxChars}
                    </Badge>
                  </div>
                </div>

                {linkUrl ? (
                  <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-sm">
                    <Link className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{linkUrl}</span>
                    <button type="button" onClick={() => setLinkUrl('')} className="text-muted-foreground hover:text-foreground">
                      ×
                    </button>
                  </div>
                ) : null}

                {media.length ? (
                  <div className="flex gap-2">
                    {media.map((url, index) => (
                      <div key={url} className="relative h-24 w-24 overflow-hidden rounded-xl border">
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setMedia((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}
                          className="absolute right-1 top-1 rounded-full bg-black/50 px-1.5 text-xs text-white"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer rounded-md border p-2 text-muted-foreground hover:bg-accent">
                    <Image className="h-4 w-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                  <Input
                    placeholder="Add a link..."
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.target.value)}
                    className="max-w-xs"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(event) => setScheduleAt(event.target.value)}
                    className="max-w-xs"
                  />
                  <Button variant="outline" onClick={() => publish('schedule')} disabled={loading || !content.trim()}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Schedule
                  </Button>
                  <Button onClick={() => publish('now')} disabled={loading || !content.trim()}>
                    <Send className="mr-2 h-4 w-4" />
                    Post now
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function platformLabel(platform: SocialPlatform) {
  if (platform === 'facebook') return 'Facebook'
  if (platform === 'linkedin') return 'LinkedIn'
  return 'X'
}
