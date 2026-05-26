import { useEffect, useRef, useState } from 'react'
import { useLocation, useOutletContext } from 'react-router-dom'
import {
  Calendar,
  CheckCircle2,
  Eye,
  Loader2,
  Link,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { ResearchTopicModal } from '@/components/compose/ResearchTopicModal'
import { RemixPostModal } from '@/components/compose/RemixPostModal'
import { StockImagePicker, type StockImageMeta } from '@/components/compose/StockImagePicker'
import type { Workspace } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { isDemoMode } from '@/lib/demo'
import {
  buildVideoPrompt,
  COMPOSE_CHAR_LIMITS,
  platformLabel,
  sanitizeComposeCopy,
  type ComposePlatform,
} from '@/lib/compose-copy'
import { redirectToEdgeFunction, supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { Database } from '@/types/database'

interface OutletContext {
  currentWorkspaceId: string | null
  currentWorkspace: Workspace | null
}

type MediaSourceType = 'ai-image' | 'ai-video' | 'stock-image' | 'user-media'
type MediaItem = { url: string; type: 'image' | 'video'; source: MediaSourceType; meta?: StockImageMeta | Record<string, unknown> }
type PlannerTaskInsert = Database['public']['Tables']['planner_tasks']['Insert']
type ScheduledPostInsert = Database['public']['Tables']['scheduled_posts']['Insert']

const PLATFORMS: ComposePlatform[] = ['facebook', 'linkedin', 'x']

type ComposeLocationState = {
  libraryUrl?: string
  libraryType?: 'image' | 'video'
  caption?: string
  visualIdea?: string
  remixPostText?: string
  competitorNiche?: string
  platform?: ComposePlatform
}

type CompletedPost = {
  action: 'now' | 'schedule'
  platform: ComposePlatform
  content: string
  media: MediaItem[]
  scheduledAt: string
}

export function ComposePage() {
  const location = useLocation()
  const { currentWorkspaceId, currentWorkspace } = useOutletContext<OutletContext>()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<ComposePlatform>('facebook')
  const [content, setContent] = useState('')
  const [draftTopic, setDraftTopic] = useState('')
  const [imageHint, setImageHint] = useState('')
  const [videoHint, setVideoHint] = useState('')
  const [media, setMedia] = useState<MediaItem[]>([])
  const [linkUrl, setLinkUrl] = useState('')
  const [scheduleAt, setScheduleAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [copyLoading, setCopyLoading] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)
  const [videoLoading, setVideoLoading] = useState(false)
  const [mediaSource, setMediaSource] = useState<MediaSourceType>('ai-image')
  const [showStockPicker, setShowStockPicker] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [firstDraftCreated, setFirstDraftCreated] = useState(false)
  const [replaceInPreview, setReplaceInPreview] = useState(false)
  const [message, setMessage] = useState('')
  const [showResearch, setShowResearch] = useState(false)
  const [showRemix, setShowRemix] = useState(false)
  const [remixSeed, setRemixSeed] = useState({ text: '', niche: '' })
  const [showDraftRequired, setShowDraftRequired] = useState(false)
  const [completedPost, setCompletedPost] = useState<CompletedPost | null>(null)
  const [showCompletedPost, setShowCompletedPost] = useState(false)
  const userMediaInputRef = useRef<HTMLInputElement | null>(null)

  const brandName = currentWorkspace?.name ?? 'Your brand'

  const maxChars = COMPOSE_CHAR_LIMITS[activeTab]
  const charCount = content.length

  useEffect(() => {
    const state = location.state as ComposeLocationState | null
    if (!state) {
      return
    }

    if (state.platform) {
      setActiveTab(state.platform)
    }
    if (state.libraryUrl && state.libraryType) {
      setMedia((prev) => [...prev, { url: state.libraryUrl!, type: state.libraryType!, source: 'user-media' }])
      setMessage('Added media from AI Library.')
    }
    if (state.caption) {
      setContent(sanitizeComposeCopy(state.caption))
    }
    if (state.visualIdea) {
      setImageHint(state.visualIdea)
    }
    if (state.remixPostText) {
      setRemixSeed({ text: state.remixPostText, niche: state.competitorNiche ?? '' })
      setShowRemix(true)
      setMessage('Paste ready for Inspiration Engine remix.')
    }

    if (state.libraryUrl || state.caption || state.remixPostText) {
      window.history.replaceState({}, '', location.pathname)
    }
  }, [location.pathname, location.state])

  const aiSaveContext = () => {
    if (!currentWorkspaceId || !user?.id) {
      return null
    }
    return {
      workspace_id: currentWorkspaceId,
      user_id: user.id,
      source: 'compose' as const,
    }
  }

  const connect = (provider: ComposePlatform) => {
    if (isDemoMode) {
      setMessage(`Demo mode: ${platformLabel(provider)} connected.`)
      return
    }

    void redirectToEdgeFunction(`${provider}-oauth-start`, { workspace_id: currentWorkspaceId })
  }

  const publish = async (action: 'now' | 'schedule') => {
    if (!currentWorkspaceId) return

    setLoading(true)
    setMessage('')

    try {
      const cleanContent = sanitizeComposeCopy(content)
      const mediaSnapshot = [...media]
      const targetTime = action === 'now' ? new Date().toISOString() : scheduleAt || new Date().toISOString()

      if (isDemoMode) {
        setMessage(`Demo mode: ${action === 'now' ? 'posted' : 'scheduled'} to ${platformLabel(activeTab)}.`)
        setCompletedPost({
          action,
          platform: activeTab,
          content: cleanContent,
          media: mediaSnapshot,
          scheduledAt: targetTime,
        })
        setShowCompletedPost(true)
        resetForm()
        return
      }

      if (!user?.id) {
        throw new Error('You need to be signed in to create a post.')
      }

      const mediaUrls = media.map((item) => item.url)

      const plannerTask: PlannerTaskInsert = {
        user_id: user.id,
        workspace_id: currentWorkspaceId,
        title: cleanContent.slice(0, 60) || `${platformLabel(activeTab)} post`,
        description: cleanContent,
        scheduled_at: targetTime,
        duration_minutes: 15,
        status: 'scheduled',
        kind: 'post',
        platform: activeTab,
        payload: { media_urls: mediaUrls, link_url: linkUrl },
      }

      const taskRes = await supabase.from('planner_tasks').insert(plannerTask as never).select().single()
      if (taskRes.error) throw taskRes.error

      const createdTask = taskRes.data as { id: string }
      const scheduledPost: ScheduledPostInsert = {
        planner_task_id: createdTask.id,
        platform: activeTab,
        content: cleanContent,
        media_urls: mediaUrls.length ? mediaUrls : null,
      }

      const scheduledPostRes = await supabase.from('scheduled_posts').insert(scheduledPost as never)
      if (scheduledPostRes.error) throw scheduledPostRes.error

      if (action === 'now') {
        await supabase.functions.invoke(`${activeTab}-api`, {
          body: { task_id: createdTask.id, content: cleanContent, media_urls: mediaUrls },
        })
      }

      setMessage(`${action === 'now' ? 'Posted' : 'Scheduled'} to ${platformLabel(activeTab)}.`)
      setCompletedPost({
        action,
        platform: activeTab,
        content: cleanContent,
        media: mediaSnapshot,
        scheduledAt: targetTime,
      })
      setShowCompletedPost(true)
      resetForm()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save this post right now.')
    } finally {
      setLoading(false)
    }
  }

  const handleUserMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image'

    if (isDemoMode) {
      const url = URL.createObjectURL(file)
      insertMedia({ url, type: mediaType, source: 'user-media' }, replaceInPreview)
      setReplaceInPreview(false)
      return
    }

    if (!currentWorkspaceId || !user?.id) {
      return
    }

    const path = `${currentWorkspaceId}/${user.id}/${Date.now()}_${file.name}`
    const { data, error } = await supabase.storage.from('media').upload(path, file)
    if (!error && data) {
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(data.path)
      insertMedia({ url: urlData.publicUrl, type: mediaType, source: 'user-media' }, replaceInPreview)
      setReplaceInPreview(false)
    }
    event.target.value = ''
  }

  const draftWithAi = async () => {
    if (!draftTopic.trim()) {
      setMessage('Add a topic or angle for the AI draft.')
      return
    }

    setCopyLoading(true)
    setMessage('Writing your draft with AI...')
    try {
      if (isDemoMode) {
        const nextContent = sanitizeComposeCopy(
          `Here is a ${platformLabel(activeTab)} post about ${draftTopic}. Clear, friendly, and ready to publish without sounding like a template.`,
        )
        setContent(nextContent)
        if (!firstDraftCreated) {
          setFirstDraftCreated(true)
          setShowPreview(true)
        }
        requestAnimationFrame(() => autoRunSelectedMediaForDraft(nextContent))
        return
      }

      const data = await invokeAi<{ content?: string }>('generate-compose-copy', {
        platform: activeTab,
        mode: 'draft',
        topic: draftTopic,
        workspace_id: currentWorkspaceId,
      })
      if (data.content) {
        const nextContent = sanitizeComposeCopy(data.content)
        setContent(nextContent)
        if (!firstDraftCreated) {
          setFirstDraftCreated(true)
          setShowPreview(true)
        }
        requestAnimationFrame(() => autoRunSelectedMediaForDraft(nextContent))
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not draft post copy.')
    } finally {
      setCopyLoading(false)
    }
  }

  const polishWithAi = async () => {
    if (!content.trim()) {
      setMessage('Write something first, then polish it with AI.')
      return
    }

    setCopyLoading(true)
    setMessage('Polishing your draft...')
    try {
      if (isDemoMode) {
        setContent(sanitizeComposeCopy(`${content.trim()} (polished for a natural, professional tone.)`))
        return
      }

      const data = await invokeAi<{ content?: string }>('generate-compose-copy', {
        platform: activeTab,
        mode: 'polish',
        content: sanitizeComposeCopy(content),
        workspace_id: currentWorkspaceId,
      })
      if (data.content) {
        setContent(sanitizeComposeCopy(data.content))
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not polish post copy.')
    } finally {
      setCopyLoading(false)
    }
  }

  const generateImage = async (regenerate: boolean, contentOverride?: string) => {
    const baseContent = sanitizeComposeCopy(contentOverride ?? content)
    if (!baseContent.trim() && !imageHint.trim()) {
      setMessage('Add post text or an image direction before generating.')
      return
    }

    setImageLoading(true)
    setMessage(regenerate ? 'Regenerating image...' : 'Generating image...')
    try {
      if (isDemoMode) {
        const url = `https://placehold.co/800x800?text=${encodeURIComponent(platformLabel(activeTab))}+Image`
        upsertMedia({ url, type: 'image', source: 'ai-image' }, regenerate)
        return
      }

      const ctx = aiSaveContext()
      if (!ctx) {
        throw new Error('Choose a workspace and sign in to generate images.')
      }

      const data = await invokeAi<{ url?: string }>('generate-image', {
        platform: activeTab,
        post_text: baseContent,
        hint: imageHint,
        prompt: regenerate ? `${imageHint || baseContent} (alternate composition, different angle)` : undefined,
        ...ctx,
      })
      if (data.url) {
        upsertMedia({ url: data.url, type: 'image', source: 'ai-image' }, regenerate)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not generate image.')
    } finally {
      setImageLoading(false)
    }
  }

  const generateVideo = async (regenerate: boolean, contentOverride?: string) => {
    const baseContent = sanitizeComposeCopy(contentOverride ?? content)
    if (!baseContent.trim() && !videoHint.trim()) {
      setMessage('Add post text or a video direction before generating.')
      return
    }

    setVideoLoading(true)
    setMessage(regenerate ? 'Regenerating video (this can take a minute)...' : 'Generating video (this can take a minute)...')
    try {
      if (isDemoMode) {
        const url = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
        upsertMedia({ url, type: 'video', source: 'ai-video' }, regenerate)
        setMessage('Demo video added.')
        return
      }

      const ctx = aiSaveContext()
      if (!ctx) {
        throw new Error('Choose a workspace and sign in to generate video.')
      }

      const prompt = buildVideoPrompt(activeTab, baseContent, videoHint, regenerate)

      const data = await invokeAi<{ url?: string }>('generate-video', { prompt, duration_seconds: 15, ...ctx })
      if (data.url) {
        upsertMedia({ url: data.url, type: 'video', source: 'ai-video' }, regenerate)
        setMessage('Video generated.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not generate video.')
    } finally {
      setVideoLoading(false)
    }
  }

  function insertMedia(item: MediaItem, replaceCurrent = false) {
    setMedia((prev) => {
      if (!replaceCurrent || prev.length === 0) return [...prev, item]
      return [...prev.slice(0, -1), item]
    })
  }

  function upsertMedia(item: MediaItem, replace: boolean) {
    setMedia((prev) => {
      if (!replace) {
        return [...prev, item]
      }
      const index = [...prev].reverse().findIndex((entry) => entry.type === item.type)
      if (index === -1) {
        return [...prev, item]
      }
      const actualIndex = prev.length - 1 - index
      return prev.map((entry, i) => (i === actualIndex ? item : entry))
    })
  }

  function resetForm() {
    setContent('')
    setDraftTopic('')
    setImageHint('')
    setVideoHint('')
    setMedia([])
    setLinkUrl('')
    setScheduleAt('')
    setShowPreview(false)
    setFirstDraftCreated(false)
  }

  const activeMedia = media[media.length - 1] ?? null
  const draftReady = firstDraftCreated || Boolean(content.trim())
  const isGenerating = copyLoading || imageLoading || videoLoading || loading

  const autoRunSelectedMediaForDraft = (nextContent: string) => {
    const clean = sanitizeComposeCopy(nextContent)
    if (!clean.trim()) return

    if (mediaSource === 'ai-image') {
      void generateImage(false, clean)
      return
    }
    if (mediaSource === 'ai-video') {
      void generateVideo(false, clean)
      return
    }
    if (mediaSource === 'stock-image') {
      setShowStockPicker(true)
      return
    }
    if (mediaSource === 'user-media') {
      userMediaInputRef.current?.click()
    }
  }

  const onSelectMediaSource = (source: MediaSourceType) => {
    setMediaSource(source)
    if (!draftReady) {
      setShowDraftRequired(true)
      setMessage('Create your post draft first, then add or generate media.')
      return
    }
    if (source === 'stock-image') {
      setShowStockPicker(true)
      return
    }
    if (source === 'user-media') {
      setReplaceInPreview(false)
      userMediaInputRef.current?.click()
      return
    }
    if (source === 'ai-image') {
      void generateImage(false)
      return
    }
    void generateVideo(false)
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Compose</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Write, research, remix, and publish with Post Intelligence. All content stays scoped to your workspace.
        </p>
      </div>

      {message ? (
        <div className="mb-4 rounded-2xl border bg-primary/5 px-4 py-3 text-sm text-foreground">{message}</div>
      ) : null}
      {isGenerating ? (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>AI is working on your content...</span>
        </div>
      ) : null}

      <Tabs>
        <TabsList className="mb-4">
          {PLATFORMS.map((platform) => (
            <TabsTrigger
              key={platform}
              value={platform}
              activeValue={activeTab}
              onClick={(value) => setActiveTab(value as ComposePlatform)}
            >
              {platformLabel(platform)}
            </TabsTrigger>
          ))}
        </TabsList>

        {PLATFORMS.map((platform) => (
          <TabsContent key={platform} value={platform} activeValue={activeTab}>
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base">{platformLabel(platform)} composer</CardTitle>
                  <CardDescription className="mt-1">Write, research, and publish with media in one simple flow.</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => connect(platform)}>
                  Connect {platformLabel(platform)}
                </Button>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Media Source</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={mediaSource === 'ai-image' ? 'default' : 'outline'}
                      onClick={() => onSelectMediaSource('ai-image')}
                      disabled={imageLoading}
                    >
                      AI Image
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={mediaSource === 'ai-video' ? 'default' : 'outline'}
                      onClick={() => onSelectMediaSource('ai-video')}
                      disabled={videoLoading}
                    >
                      AI Video
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={mediaSource === 'stock-image' ? 'default' : 'outline'}
                      onClick={() => onSelectMediaSource('stock-image')}
                    >
                      Stock Image
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={mediaSource === 'user-media' ? 'default' : 'outline'}
                      onClick={() => onSelectMediaSource('user-media')}
                    >
                      User Media
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {draftReady
                      ? 'AI Video generates clips with a minimum target duration of 15 seconds.'
                      : 'Write or generate your post draft first to unlock image and video tools.'}
                  </p>
                </div>

                <div className="rounded-2xl border bg-muted/20 p-4 space-y-3">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border bg-background p-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Write</p>
                      <div className="flex flex-wrap gap-2">
                        <Input
                          placeholder="Topic for Write with AI..."
                          value={draftTopic}
                          onChange={(event) => setDraftTopic(event.target.value)}
                          className="min-w-[200px] flex-1"
                        />
                        <Button type="button" variant="outline" disabled={copyLoading} onClick={() => void draftWithAi()}>
                          {copyLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                          {copyLoading ? 'Writing...' : 'Write with AI'}
                        </Button>
                        <Button type="button" variant="outline" disabled={copyLoading || !content.trim()} onClick={() => void polishWithAi()}>
                          {copyLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                          {copyLoading ? 'Polishing...' : 'Polish'}
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-xl border bg-background p-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Research</p>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={() => setShowResearch(true)}>
                          <Search className="mr-2 h-4 w-4" />
                          Research Topic
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setRemixSeed({ text: content, niche: '' })
                            setShowRemix(true)
                          }}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          Remix Competitor Post
                        </Button>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Captions are written to stay human, professional, and avoid em dashes.
                  </p>
                </div>

                <div className="relative">
                  <Textarea
                    placeholder="What's on your mind?"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    onBlur={() => setContent((current) => sanitizeComposeCopy(current))}
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
                  <div className="flex flex-wrap gap-2">
                    {media.map((item, index) => (
                      <div key={`${item.url}-${index}`} className="relative h-28 w-28 overflow-hidden rounded-xl border">
                        {item.type === 'video' ? (
                          <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                        ) : (
                          <img src={item.url} alt="" className="h-full w-full object-cover" />
                        )}
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

                <div className="space-y-2 rounded-2xl border p-3">
                  {draftReady && mediaSource === 'ai-image' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        placeholder="Image direction (optional)"
                        value={imageHint}
                        onChange={(event) => setImageHint(event.target.value)}
                        className="min-w-[220px] flex-1"
                      />
                      <Button type="button" size="sm" variant="outline" disabled={imageLoading} onClick={() => void generateImage(false)}>
                        {imageLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {imageLoading ? 'Generating...' : 'Generate image'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={imageLoading || !media.some((item) => item.type === 'image')}
                        onClick={() => void generateImage(true)}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Regenerate
                      </Button>
                    </div>
                  ) : null}

                  {draftReady && mediaSource === 'ai-video' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        placeholder="Video direction (optional)"
                        value={videoHint}
                        onChange={(event) => setVideoHint(event.target.value)}
                        className="min-w-[220px] flex-1"
                      />
                      <Button type="button" size="sm" variant="outline" disabled={videoLoading} onClick={() => void generateVideo(false)}>
                        {videoLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {videoLoading ? 'Generating...' : 'Generate video'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={videoLoading || !media.some((item) => item.type === 'video')}
                        onClick={() => void generateVideo(true)}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Regenerate
                      </Button>
                    </div>
                  ) : null}

                  {draftReady && mediaSource === 'stock-image' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-muted-foreground">Browse Pixabay stock images and select one for this post.</p>
                      <Button size="sm" variant="outline" onClick={() => setShowStockPicker(true)}>Open stock picker</Button>
                    </div>
                  ) : null}

                  {draftReady && mediaSource === 'user-media' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-muted-foreground">Upload your own image or video.</p>
                      <Button size="sm" variant="outline" onClick={() => userMediaInputRef.current?.click()}>Upload media</Button>
                    </div>
                  ) : null}

                  {draftReady ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={videoLoading || !media.some((item) => item.type === 'video')}
                        onClick={() => void generateVideo(true)}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Regenerate video
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReplaceInPreview(true)
                          setShowStockPicker(true)
                        }}
                      >
                        Replace image with stock
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReplaceInPreview(true)
                          userMediaInputRef.current?.click()
                        }}
                      >
                        Replace image with user
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Add a link..."
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.target.value)}
                    className="max-w-xs"
                  />
                  {firstDraftCreated ? (
                    <Button type="button" variant="outline" onClick={() => setShowPreview(true)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Preview Post
                    </Button>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(event) => setScheduleAt(event.target.value)}
                    className="max-w-xs"
                  />
                  <Button variant="outline" onClick={() => publish('schedule')} disabled={loading || !content.trim()}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calendar className="mr-2 h-4 w-4" />}
                    {loading ? 'Saving...' : 'Schedule Post'}
                  </Button>
                  <Button onClick={() => publish('now')} disabled={loading || !content.trim()}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    {loading ? 'Publishing...' : 'Publish Now'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <ResearchTopicModal
        open={showResearch}
        onOpenChange={setShowResearch}
        platform={activeTab}
        brandName={brandName}
        workspaceId={currentWorkspaceId}
        initialTopic={draftTopic || content.slice(0, 80)}
        onUseCaption={(caption, visualIdea) => {
          const nextContent = sanitizeComposeCopy(caption)
          setContent(nextContent)
          setImageHint(visualIdea)
          setMessage('Research caption applied.')
          requestAnimationFrame(() => autoRunSelectedMediaForDraft(nextContent))
        }}
        onGenerateVisual={(visualIdea) => {
          setImageHint(visualIdea)
          void generateImage(false)
        }}
        onSchedulePost={(caption, suggestedTime) => {
          const nextContent = sanitizeComposeCopy(caption)
          setContent(nextContent)
          setMessage(`Caption applied. Pick a date below. Suggested: ${suggestedTime}`)
          requestAnimationFrame(() => autoRunSelectedMediaForDraft(nextContent))
        }}
      />

      <RemixPostModal
        open={showRemix}
        onOpenChange={setShowRemix}
        platform={activeTab}
        brandName={brandName}
        workspaceId={currentWorkspaceId}
        initialPostText={remixSeed.text}
        initialCompetitorNiche={remixSeed.niche}
        onSendToComposer={(caption, visualIdea, scheduleHint) => {
          const nextContent = sanitizeComposeCopy(caption)
          setContent(nextContent)
          setImageHint(visualIdea)
          setMessage(`Brand-safe version ready. Schedule hint: ${scheduleHint}`)
          requestAnimationFrame(() => autoRunSelectedMediaForDraft(nextContent))
        }}
        onGenerateVisual={(visualIdea) => {
          setImageHint(visualIdea)
          void generateImage(false)
        }}
        onScheduleInspiredPost={(caption, visualIdea, scheduleHint) => {
          const nextContent = sanitizeComposeCopy(caption)
          setContent(nextContent)
          setImageHint(visualIdea)
          setMessage(`Schedule inspired post. Suggested timing: ${scheduleHint}. Set date/time below, then Schedule Post.`)
          requestAnimationFrame(() => autoRunSelectedMediaForDraft(nextContent))
        }}
      />

      <StockImagePicker
        open={showStockPicker}
        onOpenChange={setShowStockPicker}
        onSelect={(imageUrl, meta) => {
          insertMedia({ url: imageUrl, type: 'image', source: 'stock-image', meta }, replaceInPreview)
          setReplaceInPreview(false)
          setMessage('Stock image selected.')
        }}
      />

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto" onClick={(event) => event.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Post Preview</DialogTitle>
            <DialogDescription>Review your draft and media before continuing.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <Textarea readOnly value={sanitizeComposeCopy(content)} className="min-h-[140px]" />
            {activeMedia ? (
              activeMedia.type === 'video' ? (
                <video src={activeMedia.url} controls className="h-64 w-full rounded-xl border object-cover" />
              ) : (
                <img src={activeMedia.url} alt="" className="h-64 w-full rounded-xl border object-cover" />
              )
            ) : (
              <div className="flex h-40 items-center justify-center rounded-xl border text-sm text-muted-foreground">
                No media selected yet.
              </div>
            )}

            {firstDraftCreated ? (
              <div className="space-y-2 rounded-xl border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Media actions</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void generateImage(true)} disabled={imageLoading}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerate AI Image
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void generateVideo(true)} disabled={videoLoading}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerate AI Video
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReplaceInPreview(true)
                      userMediaInputRef.current?.click()
                    }}
                  >
                    Replace with User Media
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReplaceInPreview(true)
                      setShowStockPicker(true)
                    }}
                  >
                    Replace with Stock Image
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">You can switch between image and video regeneration after the first draft is created.</p>
              </div>
            ) : null}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowPreview(false)}>Close</Button>
          </DialogFooter>
        </div>
      </Dialog>
      <Dialog open={showDraftRequired} onOpenChange={setShowDraftRequired}>
        <DialogHeader>
          <DialogTitle>Create draft first</DialogTitle>
          <DialogDescription>
            Start with post text using Write with AI or typing your own draft. Then image/video tools unlock.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowDraftRequired(false)}>Close</Button>
        </DialogFooter>
      </Dialog>
      <Dialog open={showCompletedPost} onOpenChange={setShowCompletedPost}>
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto" onClick={(event) => event.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Post completed
            </DialogTitle>
            <DialogDescription>
              {completedPost
                ? `${completedPost.action === 'now' ? 'Published' : 'Scheduled'} on ${platformLabel(completedPost.platform)}`
                : 'Your post is ready.'}
            </DialogDescription>
          </DialogHeader>
          {completedPost ? (
            <div className="mt-4 space-y-3">
              <Textarea readOnly value={completedPost.content} className="min-h-[140px]" />
              {completedPost.media.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {completedPost.media.map((item, index) =>
                    item.type === 'video' ? (
                      <video key={`${item.url}-${index}`} src={item.url} controls className="h-44 w-full rounded-xl border object-cover" />
                    ) : (
                      <img key={`${item.url}-${index}`} src={item.url} alt="" className="h-44 w-full rounded-xl border object-cover" />
                    ),
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No media attached.</p>
              )}
            </div>
          ) : null}
          <DialogFooter className="mt-4">
            <Button onClick={() => setShowCompletedPost(false)}>Done</Button>
          </DialogFooter>
        </div>
      </Dialog>
      <input
        ref={userMediaInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleUserMediaUpload}
      />
    </div>
  )
}

async function invokeAi<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, { body })
  if (error) {
    throw new Error(error.message)
  }
  const payload = data as T & { error?: string }
  if (payload && typeof payload === 'object' && 'error' in payload && payload.error) {
    throw new Error(payload.error)
  }
  return data as T
}
