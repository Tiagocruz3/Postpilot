import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import {
  Calendar,
  Check,
  CheckCircle2,
  Eye,
  Image as ImageIcon,
  Loader2,
  Link,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Video as VideoIcon,
} from 'lucide-react'
import { ComposeAiWriteSection } from '@/components/compose/ComposeAiWriteSection'
import { ComposeFlowProgressModal } from '@/components/compose/ComposeFlowProgressModal'
import { ResearchTopicModal } from '@/components/compose/ResearchTopicModal'
import { RemixPostModal } from '@/components/compose/RemixPostModal'
import { StockImagePicker, type StockImageMeta } from '@/components/compose/StockImagePicker'
import { PlatformPostPreview, type PreviewPlatform } from '@/components/preview/PlatformPostPreview'
import type { Workspace } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspaceIntegrations } from '@/hooks/useWorkspaceIntegrations'
import { isDemoMode } from '@/lib/demo'
import {
  buildVideoPrompt,
  COMPOSE_CHAR_LIMITS,
  platformLabel,
  sanitizeComposeCopy,
  type ComposePlatform,
} from '@/lib/compose-copy'
import { appendDemoVaultItem, saveGeneratedMediaToVault } from '@/lib/ai-library'
import { invokeAiWithCredits } from '@/lib/ai-invoke'
import { useCredits } from '@/contexts/CreditContext'
import { APP_PAGE } from '@/lib/app-labels'
import { redirectToEdgeFunction, supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
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

const PLATFORMS: ComposePlatform[] = ['facebook', 'instagram', 'linkedin', 'x']

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
  permalinkUrl?: string | null
  previewImageUrl?: string | null
  platformPostId?: string | null
  scheduledPostId?: string | null
  errorMessage?: string | null
}

type AiMediaResponse = {
  url?: string
  library_id?: string | null
  model?: string
  fallback_notice?: string | null
  library_save_error?: string | null
}

type DraftSnapshot = {
  activeTab: ComposePlatform
  content: string
  draftTopic: string
  imageHint: string
  videoHint: string
  media: MediaItem[]
  linkUrl: string
  scheduleAt: string
  firstDraftCreated: boolean
}

const DRAFT_STORAGE_PREFIX = 'compose-draft:'

function draftStorageKey(workspaceId: string | null) {
  return workspaceId ? `${DRAFT_STORAGE_PREFIX}${workspaceId}` : null
}

function loadDraftSnapshot(workspaceId: string | null): Partial<DraftSnapshot> | null {
  const key = draftStorageKey(workspaceId)
  if (!key || typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as Partial<DraftSnapshot>
  } catch {
    return null
  }
}

function clearDraftSnapshot(workspaceId: string | null) {
  const key = draftStorageKey(workspaceId)
  if (!key || typeof window === 'undefined') return
  window.sessionStorage.removeItem(key)
}

export function ComposePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentWorkspaceId, currentWorkspace } = useOutletContext<OutletContext>()
  const { user } = useAuth()

  const initialSnapshot = loadDraftSnapshot(currentWorkspaceId)
  const snapshotWorkspaceRef = useRef<string | null>(currentWorkspaceId)
  const draftRestoredRef = useRef(Boolean(initialSnapshot))

  const [activeTab, setActiveTab] = useState<ComposePlatform>(initialSnapshot?.activeTab ?? 'facebook')
  const [content, setContent] = useState(initialSnapshot?.content ?? '')
  const [draftTopic, setDraftTopic] = useState(initialSnapshot?.draftTopic ?? '')
  const [imageHint, setImageHint] = useState(initialSnapshot?.imageHint ?? '')
  const [videoHint, setVideoHint] = useState(initialSnapshot?.videoHint ?? '')
  const [media, setMedia] = useState<MediaItem[]>(initialSnapshot?.media ?? [])
  const [linkUrl, setLinkUrl] = useState(initialSnapshot?.linkUrl ?? '')
  const [scheduleAt, setScheduleAt] = useState(initialSnapshot?.scheduleAt ?? '')
  const [loading, setLoading] = useState(false)
  const [copyLoading, setCopyLoading] = useState(false)
  const [copyAction, setCopyAction] = useState<'draft' | 'polish' | null>(null)
  const [imageLoading, setImageLoading] = useState(false)
  const [videoLoading, setVideoLoading] = useState(false)
  const [mediaSource, setMediaSource] = useState<MediaSourceType>('ai-image')
  const [showStockPicker, setShowStockPicker] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [attachmentPreview, setAttachmentPreview] = useState<MediaItem | null>(null)
  const [firstDraftCreated, setFirstDraftCreated] = useState(Boolean(initialSnapshot?.firstDraftCreated))
  const [replaceInPreview, setReplaceInPreview] = useState(false)
  const [message, setMessage] = useState('')
  const [showResearch, setShowResearch] = useState(false)
  const [showRemix, setShowRemix] = useState(false)
  const [remixSeed, setRemixSeed] = useState({ text: '', niche: '' })
  const [completedPost, setCompletedPost] = useState<CompletedPost | null>(null)
  const [showCompletedPost, setShowCompletedPost] = useState(false)
  const { integrations, isConnected, refresh: refreshIntegrations } = useWorkspaceIntegrations(currentWorkspaceId)
  const { consumeCredits } = useCredits()
  const userMediaInputRef = useRef<HTMLInputElement | null>(null)
  const [updatingTarget, setUpdatingTarget] = useState(false)

  const invokeAi = useCallback(
    <T,>(functionName: string, body: Record<string, unknown>) =>
      invokeAiWithCredits<T>(functionName, body, consumeCredits, { workspaceId: currentWorkspaceId }),
    [consumeCredits, currentWorkspaceId],
  )

  const facebookIntegration = integrations.find(
    (row) => row.provider === 'facebook' || row.provider === 'meta',
  )
  const linkedinIntegration = integrations.find((row) => row.provider === 'linkedin')

  const facebookPages = (() => {
    const raw = facebookIntegration?.metadata?.pages
    if (!Array.isArray(raw)) return []
    return raw
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null
        const record = entry as Record<string, unknown>
        const id = typeof record.id === 'string' ? record.id : null
        const name = typeof record.name === 'string' ? record.name : id
        return id ? { id, name: name || id } : null
      })
      .filter((entry): entry is { id: string; name: string } => Boolean(entry))
  })()

  const instagramAccounts = (() => {
    const raw = facebookIntegration?.metadata?.instagram_accounts
    if (!Array.isArray(raw)) return []
    return raw
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null
        const record = entry as Record<string, unknown>
        const id = typeof record.id === 'string' ? record.id : null
        const username = typeof record.username === 'string' ? record.username : id
        const name = typeof record.name === 'string' ? record.name : username
        return id ? { id, username: username || id, name: name || username || id } : null
      })
      .filter((entry): entry is { id: string; username: string; name: string } => Boolean(entry))
  })()

  const linkedinProfiles = (() => {
    const raw = linkedinIntegration?.metadata?.profiles
    if (Array.isArray(raw) && raw.length > 0) {
      return raw
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null
          const record = entry as Record<string, unknown>
          const id = typeof record.id === 'string' ? record.id : null
          const name = typeof record.name === 'string' ? record.name : id
          const type = record.type === 'organization' ? 'organization' : 'person'
          return id ? { id, name: name || id, type } : null
        })
        .filter((entry): entry is { id: string; name: string; type: 'person' | 'organization' } => Boolean(entry))
    }
    const linkedinId = linkedinIntegration?.metadata?.linkedin_id
    if (typeof linkedinId === 'string' && linkedinIntegration) {
      const name =
        (typeof linkedinIntegration.metadata?.linkedin_name === 'string' &&
          linkedinIntegration.metadata.linkedin_name) ||
        'Personal profile'
      return [{ id: linkedinId, name, type: 'person' as const }]
    }
    return []
  })()

  const selectedFacebookPageId =
    (facebookIntegration?.metadata as { selected_page_id?: string } | undefined)?.selected_page_id ||
    (facebookIntegration?.metadata as { page_id?: string } | undefined)?.page_id ||
    facebookPages[0]?.id ||
    ''

  const selectedInstagramAccountId =
    (facebookIntegration?.metadata as { selected_instagram_account_id?: string | null } | undefined)
      ?.selected_instagram_account_id ||
    instagramAccounts[0]?.id ||
    ''

  const selectedLinkedInProfileId =
    (linkedinIntegration?.metadata as { selected_profile_id?: string } | undefined)?.selected_profile_id ||
    (linkedinIntegration?.metadata as { linkedin_id?: string } | undefined)?.linkedin_id ||
    linkedinProfiles[0]?.id ||
    ''

  const updateIntegrationMetadata = async (
    integrationId: string,
    nextMetadata: Record<string, unknown>,
    successMessage: string,
  ) => {
    setUpdatingTarget(true)
    try {
      const { error } = await supabase
        .from('user_integrations')
        .update({ metadata: nextMetadata } as never)
        .eq('id', integrationId)
      if (error) {
        setMessage(`Could not update posting target: ${error.message}`)
      } else {
        setMessage(successMessage)
        void refreshIntegrations()
      }
    } finally {
      setUpdatingTarget(false)
    }
  }

  const updateFacebookPage = async (pageId: string) => {
    if (!facebookIntegration || pageId === selectedFacebookPageId) return
    const nextPage = facebookPages.find((page) => page.id === pageId)
    await updateIntegrationMetadata(
      facebookIntegration.id,
      {
        ...(facebookIntegration.metadata ?? {}),
        selected_page_id: pageId,
        page_id: pageId,
        page_name: nextPage?.name ?? pageId,
      },
      `Posting to ${nextPage?.name ?? pageId} on Facebook.`,
    )
  }

  const updateInstagramAccount = async (accountId: string) => {
    if (!facebookIntegration || accountId === selectedInstagramAccountId) return
    const nextAccount = instagramAccounts.find((account) => account.id === accountId)
    await updateIntegrationMetadata(
      facebookIntegration.id,
      {
        ...(facebookIntegration.metadata ?? {}),
        selected_instagram_account_id: accountId,
      },
      `Posting to @${nextAccount?.username ?? accountId} on Instagram.`,
    )
  }

  const updateLinkedInProfile = async (profileId: string) => {
    if (!linkedinIntegration || profileId === selectedLinkedInProfileId) return
    const nextProfile = linkedinProfiles.find((profile) => profile.id === profileId)
    await updateIntegrationMetadata(
      linkedinIntegration.id,
      {
        ...(linkedinIntegration.metadata ?? {}),
        selected_profile_id: profileId,
      },
      `Posting as ${nextProfile?.name ?? profileId} on LinkedIn.`,
    )
  }

  const brandName = currentWorkspace?.name ?? 'Your brand'

  const maxChars = COMPOSE_CHAR_LIMITS[activeTab]
  const charCount = content.length

  useEffect(() => {
    if (snapshotWorkspaceRef.current === currentWorkspaceId) {
      return
    }
    snapshotWorkspaceRef.current = currentWorkspaceId
    const snapshot = loadDraftSnapshot(currentWorkspaceId)
    setActiveTab(snapshot?.activeTab ?? 'facebook')
    setContent(snapshot?.content ?? '')
    setDraftTopic(snapshot?.draftTopic ?? '')
    setImageHint(snapshot?.imageHint ?? '')
    setVideoHint(snapshot?.videoHint ?? '')
    setMedia(snapshot?.media ?? [])
    setLinkUrl(snapshot?.linkUrl ?? '')
    setScheduleAt(snapshot?.scheduleAt ?? '')
    setFirstDraftCreated(Boolean(snapshot?.firstDraftCreated))
    draftRestoredRef.current = Boolean(snapshot)
  }, [currentWorkspaceId])

  useEffect(() => {
    const key = draftStorageKey(currentWorkspaceId)
    if (!key || typeof window === 'undefined') return
    const snapshot: DraftSnapshot = {
      activeTab,
      content,
      draftTopic,
      imageHint,
      videoHint,
      media,
      linkUrl,
      scheduleAt,
      firstDraftCreated,
    }
    const isEmpty =
      !content.trim() &&
      !draftTopic.trim() &&
      !imageHint.trim() &&
      !videoHint.trim() &&
      media.length === 0 &&
      !linkUrl.trim() &&
      !scheduleAt &&
      !firstDraftCreated
    if (isEmpty) {
      window.sessionStorage.removeItem(key)
    } else {
      try {
        window.sessionStorage.setItem(key, JSON.stringify(snapshot))
      } catch {
        // sessionStorage quota — silently ignore; user just won't see persistence.
      }
    }
  }, [
    currentWorkspaceId,
    activeTab,
    content,
    draftTopic,
    imageHint,
    videoHint,
    media,
    linkUrl,
    scheduleAt,
    firstDraftCreated,
  ])

  const isPlatformConnected = (platform: ComposePlatform) => {
    if (platform === 'facebook') {
      return isConnected('meta_or_facebook') && facebookPages.length > 0
    }
    if (platform === 'instagram') {
      return isConnected('meta_or_facebook') && instagramAccounts.length > 0
    }
    return isConnected(platform)
  }

  const connectProviderForPlatform = (platform: ComposePlatform) => {
    if (platform === 'instagram' || platform === 'facebook') {
      return 'facebook'
    }
    return platform
  }

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
      setMessage(`Added media from ${APP_PAGE.aiVault}.`)
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

  const saveToAiVault = async (input: {
    mediaType: 'image' | 'video'
    url: string
    prompt: string
    libraryId?: string | null
    librarySaveError?: string | null
  }) => {
    if (!currentWorkspaceId || !user?.id) {
      return { saved: false as const, reason: 'No workspace or session.' }
    }

    return saveGeneratedMediaToVault({
      workspaceId: currentWorkspaceId,
      userId: user.id,
      mediaType: input.mediaType,
      sourceUrl: input.url,
      prompt: input.prompt,
      source: 'compose',
      metadata: {
        platform: activeTab,
        server_save_error: input.librarySaveError ?? null,
      },
    })
  }

  const connect = (platform: ComposePlatform) => {
    if (isDemoMode) {
      setMessage(`Demo mode: ${platformLabel(platform)} connected.`)
      return
    }

    void redirectToEdgeFunction(`${connectProviderForPlatform(platform)}-oauth-start`, {
      workspace_id: currentWorkspaceId,
    })
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
      const mediaTypes = media.map((item) => item.type)

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
        payload: { media_urls: mediaUrls, media_types: mediaTypes, link_url: linkUrl },
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

      let permalinkUrl: string | null = null
      let previewImageUrl: string | null = mediaSnapshot.find((item) => item.type === 'image')?.url ?? null
      let platformPostId: string | null = null
      let scheduledPostId: string | null = null
      let errorMessage: string | null = null

      if (action === 'now') {
        const invokeRes = await supabase.functions.invoke<{
          success?: boolean
          permalink_url?: string | null
          preview_image_url?: string | null
          post_id?: string | null
          scheduled_post_id?: string | null
          error?: string
        }>(`${activeTab}-api`, {
          body: { task_id: createdTask.id, content: cleanContent, media_urls: mediaUrls, media_types: mediaTypes },
        })

        if (invokeRes.error) {
          const context = (invokeRes.error as { context?: { json?: () => Promise<unknown> } }).context
          let detailed = invokeRes.error.message
          if (context?.json) {
            try {
              const payload = (await context.json()) as { error?: string; message?: string }
              detailed = payload?.error || payload?.message || detailed
            } catch {
              // ignore parse failure
            }
          }
          errorMessage = detailed || `Could not publish to ${platformLabel(activeTab)}.`
        } else if (invokeRes.data?.error) {
          errorMessage = invokeRes.data.error
        } else if (invokeRes.data) {
          permalinkUrl = invokeRes.data.permalink_url ?? null
          previewImageUrl = invokeRes.data.preview_image_url ?? previewImageUrl
          platformPostId = invokeRes.data.post_id ?? null
          scheduledPostId = invokeRes.data.scheduled_post_id ?? null
        }
      }

      if (errorMessage) {
        setMessage(`Publish failed: ${errorMessage}`)
      } else {
        setMessage(`${action === 'now' ? 'Posted' : 'Scheduled'} to ${platformLabel(activeTab)}.`)
      }

      setCompletedPost({
        action,
        platform: activeTab,
        content: cleanContent,
        media: mediaSnapshot,
        scheduledAt: targetTime,
        permalinkUrl,
        previewImageUrl,
        platformPostId,
        scheduledPostId,
        errorMessage,
      })
      setShowCompletedPost(true)

      if (!errorMessage) {
        resetForm()
      }
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

    setCopyAction('draft')
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
        }
        autoRunSelectedMediaForDraft(nextContent)
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
        }
        autoRunSelectedMediaForDraft(nextContent)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not draft post copy.')
    } finally {
      setCopyAction(null)
      if (mediaSource !== 'ai-image' && mediaSource !== 'ai-video') {
        setCopyLoading(false)
      }
    }
  }

  const polishWithAi = async () => {
    if (!content.trim()) {
      setMessage('Write something first, then polish it with AI.')
      return
    }

    setCopyAction('polish')
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
      setCopyAction(null)
    }
  }

  const generateImage = async (regenerate: boolean, contentOverride?: string) => {
    const baseContent = sanitizeComposeCopy(contentOverride ?? content)
    setCopyLoading(false)
    setImageLoading(true)
    setMessage(regenerate ? 'Regenerating image...' : 'Generating image...')
    try {
      if (isDemoMode) {
        const url = `https://placehold.co/800x800?text=${encodeURIComponent(platformLabel(activeTab))}+Image`
        const demoPrompt = [draftTopic.trim(), imageHint, baseContent].filter(Boolean).join('\n\n')
        upsertMedia({ url, type: 'image', source: 'ai-image' }, regenerate)
        if (currentWorkspaceId && user?.id) {
          appendDemoVaultItem(currentWorkspaceId, user.id, {
            mediaType: 'image',
            sourceUrl: url,
            prompt: demoPrompt || baseContent,
            source: 'compose',
            metadata: { platform: activeTab, demo: true },
          })
        }
        setMessage(`Image generated. Saved to ${APP_PAGE.aiVault} (demo).`)
        return
      }

      const ctx = aiSaveContext()
      if (!ctx) {
        throw new Error('Choose a workspace and sign in to generate images.')
      }

      const initialTopic = draftTopic.trim()
      const promptContext =
        [initialTopic ? `Primary user intent/topic: ${initialTopic}` : '', imageHint, baseContent].filter(Boolean).join('\n\n') ||
        `High-quality image for a ${platformLabel(activeTab)} social post.`
      const directPrompt = regenerate
        ? `${promptContext}\n\nCreate a fresh alternate composition with a different angle while keeping the same core intent.`
        : promptContext

      const data = await invokeAi<AiMediaResponse>('generate-image', {
        platform: activeTab,
        post_text: baseContent,
        hint: imageHint,
        topic: initialTopic,
        prompt: directPrompt || undefined,
        ...ctx,
      })
      if (!data.url) {
        throw new Error('Image generation finished but no image URL was returned. Please try again.')
      }

      upsertMedia({ url: data.url, type: 'image', source: 'ai-image' }, regenerate)
      const baseStatus = data.fallback_notice ? `Image generated. ${data.fallback_notice}` : 'Image generated.'

      const libraryResult = await saveToAiVault({
        mediaType: 'image',
        url: data.url,
        prompt: directPrompt || baseContent,
        libraryId: data.library_id,
        librarySaveError: data.library_save_error,
      })
      if (libraryResult.saved) {
        setMessage(`${baseStatus} Saved to ${APP_PAGE.aiVault}.`)
      } else {
        const libDetail = libraryResult.reason || data.library_save_error || 'unknown reason'
        setMessage(`${baseStatus} Could not sync to ${APP_PAGE.aiVault} (${libDetail}). Image is still attached to this post.`)
      }

      if (firstDraftCreated) {
        setShowPreview(true)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not generate image.')
    } finally {
      setImageLoading(false)
    }
  }

  const generateVideo = async (regenerate: boolean, contentOverride?: string) => {
    const baseContent = sanitizeComposeCopy(contentOverride ?? content)
    if (!baseContent.trim() && !videoHint.trim() && !draftTopic.trim()) {
      setCopyLoading(false)
      setMessage('Add a caption, topic, or video direction before generating.')
      return
    }

    setCopyLoading(false)
    setVideoLoading(true)
    setMessage(regenerate ? 'Regenerating video (this can take a minute)...' : 'Generating video (this can take a minute)...')
    try {
      if (isDemoMode) {
        const url = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
        const demoPrompt = buildVideoPrompt(activeTab, baseContent, videoHint, regenerate)
        upsertMedia({ url, type: 'video', source: 'ai-video' }, regenerate)
        if (currentWorkspaceId && user?.id) {
          appendDemoVaultItem(currentWorkspaceId, user.id, {
            mediaType: 'video',
            sourceUrl: url,
            prompt: demoPrompt,
            source: 'compose',
            metadata: { platform: activeTab, demo: true },
          })
        }
        setMessage(`Demo video added. Saved to ${APP_PAGE.aiVault} (demo).`)
        return
      }

      const ctx = aiSaveContext()
      if (!ctx) {
        throw new Error('Choose a workspace and sign in to generate video.')
      }

      const prompt = buildVideoPrompt(activeTab, baseContent, videoHint, regenerate)

      const data = await invokeAi<AiMediaResponse>('generate-video', { prompt, duration_seconds: 15, ...ctx })
      if (data.url) {
        upsertMedia({ url: data.url, type: 'video', source: 'ai-video' }, regenerate)
        const libraryResult = await saveToAiVault({
          mediaType: 'video',
          url: data.url,
          prompt,
          libraryId: data.library_id,
          librarySaveError: data.library_save_error,
        })
        if (libraryResult.saved) {
          setMessage(`Video generated. Saved to ${APP_PAGE.aiVault}.`)
        } else {
          const libDetail = libraryResult.reason || data.library_save_error || 'unknown reason'
          setMessage(`Video generated. Could not sync to ${APP_PAGE.aiVault} (${libDetail}). Video is still attached to this post.`)
        }
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
    if (item.type === 'image') {
      setShowPreview(true)
    }
  }

  function upsertMedia(item: MediaItem, replace: boolean) {
    setMedia((prev) => {
      if (!replace) {
        return [...prev, item]
      }
      // Regenerate should fully replace prior media of the same type.
      return [...prev.filter((entry) => entry.type !== item.type), item]
    })
    if (item.type === 'image') {
      setShowPreview(true)
    }
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
    setMessage('')
    setMediaSource('ai-image')
    setShowStockPicker(false)
    setReplaceInPreview(false)
    setShowResearch(false)
    setShowRemix(false)
    setRemixSeed({ text: '', niche: '' })
    draftRestoredRef.current = false
    clearDraftSnapshot(currentWorkspaceId)
  }

  const hasComposerContent =
    Boolean(content.trim()) ||
    Boolean(draftTopic.trim()) ||
    media.length > 0 ||
    Boolean(linkUrl.trim()) ||
    Boolean(scheduleAt.trim()) ||
    firstDraftCreated

  const activeMedia = media[media.length - 1] ?? null
  const hasVisual = media.length > 0
  const draftReady = firstDraftCreated || Boolean(content.trim())
  const isGenerating = copyLoading || imageLoading || videoLoading || loading
  const [flowModalOpen, setFlowModalOpen] = useState(false)

  useEffect(() => {
    if (isGenerating) {
      setFlowModalOpen(true)
      return
    }
    const closeTimer = window.setTimeout(() => setFlowModalOpen(false), 150)
    return () => window.clearTimeout(closeTimer)
  }, [isGenerating])

  const visibleMessage = isGenerating ? '' : message
  const generationLabel = copyLoading
    ? copyAction === 'polish'
      ? 'Polishing your draft'
      : 'Writing your draft'
    : imageLoading
      ? 'Designing your image'
      : videoLoading
        ? 'Rendering your video'
        : loading
          ? 'Publishing your post'
          : ''
  const activeFlowStep: 'draft' | 'visual' | 'publish' =
    copyLoading || (!draftReady && !loading)
      ? 'draft'
      : imageLoading || videoLoading || (draftReady && !hasVisual)
        ? 'visual'
        : 'publish'

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
    setReplaceInPreview(false)
  }

  const showImageMediaTools = mediaSource === 'ai-image'
  const showVideoMediaTools = mediaSource === 'ai-video'
  const showStockMediaTools = mediaSource === 'stock-image'
  const showUserMediaTools = mediaSource === 'user-media'
  const hasImageMedia = media.some((item) => item.type === 'image')
  const hasVideoMedia = media.some((item) => item.type === 'video')

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{APP_PAGE.createStudio}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Write, research, remix, and publish with Post Intelligence. All content stays scoped to your workspace.
        </p>
      </div>

      {visibleMessage ? (
        <div className="alive-enter mb-4 rounded-2xl border bg-primary/5 px-4 py-3 text-sm text-foreground">{visibleMessage}</div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="alive-enter">
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base">Studio post</CardTitle>
            <CardDescription>One draft, every channel.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isPlatformConnected(activeTab) ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                {platformLabel(activeTab)} connected
              </span>
            ) : (
              <Button size="sm" variant="outline" onClick={() => connect(activeTab)}>
                Connect {platformLabel(activeTab)}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={resetForm}
              disabled={!hasComposerContent || isGenerating}
              title={hasComposerContent ? 'Clear draft and start over' : 'Nothing to clear yet'}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 rounded-2xl border bg-muted/20 p-3">
              <Label htmlFor="compose-platform-select" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Publish to
              </Label>
              <Select
                id="compose-platform-select"
                value={activeTab}
                onChange={(event) => setActiveTab(event.target.value as ComposePlatform)}
              >
                {PLATFORMS.map((platform) => (
                  <option key={platform} value={platform}>
                    {platformLabel(platform)}
                  </option>
                ))}
              </Select>
            </div>

            {activeTab === 'facebook' && isPlatformConnected('facebook') && facebookPages.length > 0 ? (
              <div className="space-y-2 rounded-2xl border bg-muted/20 p-3">
                <Label htmlFor="facebook-page-select" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Facebook Page
                </Label>
                <Select
                  id="facebook-page-select"
                  value={selectedFacebookPageId}
                  onChange={(event) => void updateFacebookPage(event.target.value)}
                  disabled={updatingTarget || facebookPages.length === 1}
                >
                  {facebookPages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : activeTab === 'instagram' && isPlatformConnected('instagram') && instagramAccounts.length > 0 ? (
              <div className="space-y-2 rounded-2xl border bg-muted/20 p-3">
                <Label htmlFor="instagram-account-select" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Instagram account
                </Label>
                <Select
                  id="instagram-account-select"
                  value={selectedInstagramAccountId}
                  onChange={(event) => void updateInstagramAccount(event.target.value)}
                  disabled={updatingTarget || instagramAccounts.length === 1}
                >
                  {instagramAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      @{account.username} · {account.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : activeTab === 'linkedin' && isPlatformConnected('linkedin') && linkedinProfiles.length > 0 ? (
              <div className="space-y-2 rounded-2xl border bg-muted/20 p-3">
                <Label htmlFor="linkedin-profile-select" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  LinkedIn profile
                </Label>
                <Select
                  id="linkedin-profile-select"
                  value={selectedLinkedInProfileId}
                  onChange={(event) => void updateLinkedInProfile(event.target.value)}
                  disabled={updatingTarget || linkedinProfiles.length === 1}
                >
                  {linkedinProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} {profile.type === 'organization' ? '(Page)' : '(Personal)'}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="rounded-2xl border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Posting as</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {activeTab === 'x'
                    ? 'Posts publish to your connected X account.'
                    : isPlatformConnected(activeTab)
                      ? 'Using your default account for this platform.'
                      : `Connect ${platformLabel(activeTab)} to choose where posts land.`}
                </p>
              </div>
            )}
          </div>

          {(activeTab === 'facebook' || activeTab === 'instagram') &&
          isPlatformConnected(activeTab) &&
          ((activeTab === 'facebook' && facebookPages.length === 1) ||
            (activeTab === 'instagram' && instagramAccounts.length === 1)) ? (
            <p className="text-xs text-muted-foreground">
              Only one {activeTab === 'facebook' ? 'Page' : 'Instagram account'} is connected. Reconnect Facebook in Settings
              to grant access to more.
            </p>
          ) : null}

                <div className="rounded-2xl border bg-muted/20 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Media source</p>
                    {activeMedia ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {activeMedia.type === 'video' ? 'Video attached' : 'Image attached'}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      [
                        { id: 'ai-image', label: 'AI Image', disabled: imageLoading },
                        { id: 'ai-video', label: 'AI Video', disabled: videoLoading },
                        { id: 'stock-image', label: 'Stock', disabled: false },
                        { id: 'user-media', label: 'Upload', disabled: false },
                      ] as { id: MediaSourceType; label: string; disabled: boolean }[]
                    ).map((opt) => (
                      <Button
                        key={opt.id}
                        type="button"
                        size="sm"
                        variant={mediaSource === opt.id ? 'default' : 'outline'}
                        className={mediaSource === opt.id ? 'alive-ring' : ''}
                        onClick={() => onSelectMediaSource(opt.id)}
                        disabled={opt.disabled}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {mediaSource === 'stock-image'
                      ? 'Browse a stock library and attach a photo.'
                      : mediaSource === 'user-media'
                        ? 'Upload an image or video from your device.'
                        : mediaSource === 'ai-video'
                          ? 'AI Video clips target a 15-second minimum.'
                          : 'Generate an AI image, or attach media later.'}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-end justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your post</p>
                    <span
                      className={`text-xs font-medium tabular-nums ${
                        charCount > maxChars
                          ? 'text-destructive'
                          : charCount > maxChars * 0.9
                            ? 'text-amber-600'
                            : 'text-muted-foreground'
                      }`}
                      aria-live="polite"
                    >
                      {charCount.toLocaleString()} / {maxChars.toLocaleString()} for {platformLabel(activeTab)}
                    </span>
                  </div>
                  <Textarea
                    placeholder="What's on your mind?"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    onBlur={() => setContent((current) => sanitizeComposeCopy(current))}
                    className="min-h-[180px] resize-none border-primary/20 bg-background text-base leading-relaxed shadow-sm"
                  />
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${charCount > maxChars ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${Math.min(100, Math.max(2, (charCount / maxChars) * 100))}%` }}
                    />
                  </div>
                  {charCount > maxChars ? (
                    <p className="text-xs text-destructive">
                      Over the {platformLabel(activeTab)} limit by {(charCount - maxChars).toLocaleString()} character
                      {charCount - maxChars === 1 ? '' : 's'}. Trim before publishing.
                    </p>
                  ) : null}
                </div>

                {media.length || imageLoading || videoLoading ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {imageLoading
                        ? 'Generating image…'
                        : videoLoading
                          ? 'Generating video…'
                          : 'Attached media'}
                    </p>
                    {imageLoading || videoLoading ? (
                      <div
                        className="relative aspect-square w-full max-w-[260px] overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-sky-500/5 to-cyan-500/10"
                        aria-live="polite"
                        aria-busy="true"
                      >
                        <div className="alive-shimmer absolute inset-0" />
                        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center">
                          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-background/80 shadow-sm backdrop-blur">
                            {videoLoading ? (
                              <VideoIcon className="h-6 w-6 text-primary" />
                            ) : (
                              <ImageIcon className="h-6 w-6 text-primary" />
                            )}
                            <Loader2 className="absolute -bottom-1 -right-1 h-5 w-5 animate-spin rounded-full bg-background p-0.5 text-primary shadow-sm" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {videoLoading ? 'Rendering your video' : 'Designing your image'}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {videoLoading
                                ? 'This can take up to a minute.'
                                : 'Usually ready in 10–20 seconds.'}
                            </p>
                          </div>
                          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                            <div className="alive-shimmer h-full w-2/3 rounded-full bg-primary/50" />
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {media.length ? (
                      <div className="flex flex-wrap gap-2">
                        {media.map((item, index) => (
                          <div key={`${item.url}-${index}`} className="relative h-28 w-28 overflow-hidden rounded-xl border">
                            <button
                              type="button"
                              className="block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                              onClick={() => setAttachmentPreview(item)}
                              aria-label={`Preview attached ${item.type}`}
                            >
                              {item.type === 'video' ? (
                                <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                              ) : (
                                <img src={item.url} alt="" className="h-full w-full object-cover" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setMedia((prev) => prev.filter((_, currentIndex) => currentIndex !== index))
                                if (attachmentPreview?.url === item.url) {
                                  setAttachmentPreview(null)
                                }
                              }}
                              className="absolute right-1 top-1 z-10 rounded-full bg-black/60 px-1.5 text-xs text-white hover:bg-black/80"
                              aria-label="Remove attachment"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <ComposeAiWriteSection
                  draftTopic={draftTopic}
                  onDraftTopicChange={setDraftTopic}
                  copyLoading={copyLoading}
                  canPolish={Boolean(content.trim())}
                  onWriteWithAi={() => void draftWithAi()}
                  onPolish={() => void polishWithAi()}
                  onResearch={() => setShowResearch(true)}
                  onRemix={() => {
                    setRemixSeed({ text: content, niche: '' })
                    setShowRemix(true)
                  }}
                />
        </CardContent>
      </Card>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Card className="alive-enter">
          <CardHeader>
            <CardTitle className="text-base">Publish</CardTitle>
            <CardDescription className="mt-1">
              Media tools, link, schedule, and posting — all here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 rounded-2xl border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {mediaSource === 'ai-image' && 'AI image'}
                  {mediaSource === 'ai-video' && 'AI video'}
                  {mediaSource === 'stock-image' && 'Stock image'}
                  {mediaSource === 'user-media' && 'Your media'}
                </p>

                {showImageMediaTools ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Image direction (optional)"
                      value={imageHint}
                      onChange={(event) => setImageHint(event.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" disabled={imageLoading} onClick={() => void generateImage(false)} className="flex-1">
                        {imageLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {imageLoading ? 'Generating...' : 'Generate'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={imageLoading || !hasImageMedia}
                        onClick={() => void generateImage(true)}
                        className="flex-1"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Regenerate
                      </Button>
                    </div>
                  </div>
                ) : null}

                {showVideoMediaTools ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Video direction (optional)"
                      value={videoHint}
                      onChange={(event) => setVideoHint(event.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" disabled={videoLoading} onClick={() => void generateVideo(false)} className="flex-1">
                        {videoLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {videoLoading ? 'Generating...' : 'Generate'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={videoLoading || !hasVideoMedia}
                        onClick={() => void generateVideo(true)}
                        className="flex-1"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Regenerate
                      </Button>
                    </div>
                  </div>
                ) : null}

                {showStockMediaTools ? (
                  <Button size="sm" variant="outline" onClick={() => setShowStockPicker(true)} className="w-full">
                    Browse stock library
                  </Button>
                ) : null}

                {showUserMediaTools ? (
                  <Button size="sm" variant="outline" onClick={() => userMediaInputRef.current?.click()} className="w-full">
                    Upload media
                  </Button>
                ) : null}

                {hasVisual ? (
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Replace media</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReplaceInPreview(true)
                          setShowStockPicker(true)
                        }}
                        className="flex-1"
                      >
                        Stock
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReplaceInPreview(true)
                          userMediaInputRef.current?.click()
                        }}
                        className="flex-1"
                      >
                        Your media
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={videoLoading || !hasVideoMedia}
                        onClick={() => void generateVideo(true)}
                        className="flex-1"
                        title="Regenerate AI video"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

            <div className="space-y-2">
              <Label htmlFor="compose-link" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Link
              </Label>
              {linkUrl ? (
                <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-sm">
                  <Link className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{linkUrl}</span>
                  <button type="button" onClick={() => setLinkUrl('')} className="text-muted-foreground hover:text-foreground">
                    ×
                  </button>
                </div>
              ) : (
                <Input
                  id="compose-link"
                  placeholder="Add a link..."
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="compose-schedule" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Schedule
              </Label>
              <Input
                id="compose-schedule"
                type="datetime-local"
                value={scheduleAt}
                onChange={(event) => setScheduleAt(event.target.value)}
              />
            </div>

            <div className="space-y-2 border-t pt-3">
              <Button
                onClick={() => publish('now')}
                disabled={loading || (!content.trim() && !hasVisual)}
                className="w-full"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {loading ? 'Publishing...' : 'Publish Now'}
              </Button>
              <Button
                variant="outline"
                onClick={() => publish('schedule')}
                disabled={loading || (!content.trim() && !hasVisual) || !scheduleAt}
                className="w-full"
                title={!scheduleAt ? 'Pick a date and time above first.' : undefined}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calendar className="mr-2 h-4 w-4" />}
                {loading ? 'Saving...' : 'Schedule Post'}
              </Button>
              {hasVisual ? (
                <Button type="button" variant="ghost" onClick={() => setShowPreview(true)} className="w-full">
                  <Eye className="mr-2 h-4 w-4" />
                  Preview post
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </aside>
      </div>

      <ComposeFlowProgressModal
        open={flowModalOpen}
        activeStep={activeFlowStep}
        label={generationLabel}
        draftReady={draftReady}
        hasVisual={hasVisual}
        copyLoading={copyLoading}
        copyAction={copyAction}
        imageLoading={imageLoading}
        videoLoading={videoLoading}
        publishing={loading}
        mediaSourceLabel={mediaSource.replace('-', ' ')}
      />

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
        }}
        onGenerateVisual={(visualIdea) => {
          setImageHint(visualIdea)
          void generateImage(false)
        }}
        onSchedulePost={(caption, suggestedTime) => {
          const nextContent = sanitizeComposeCopy(caption)
          setContent(nextContent)
          setMessage(`Caption applied. Pick a date below. Suggested: ${suggestedTime}`)
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

      <Dialog
        open={Boolean(attachmentPreview)}
        onOpenChange={(open) => {
          if (!open) setAttachmentPreview(null)
        }}
        panelClassName="w-full max-w-4xl p-0"
        overlayClassName="bg-black/70 backdrop-blur-[2px]"
      >
        {attachmentPreview ? (
          <div className="flex max-h-[92vh] flex-col">
            <DialogHeader className="border-b px-5 py-4 text-left">
              <DialogTitle>
                {attachmentPreview.type === 'video' ? 'Video preview' : 'Image preview'}
              </DialogTitle>
              <DialogDescription>Attached media before you publish.</DialogDescription>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/30 p-4">
              {attachmentPreview.type === 'video' ? (
                <video
                  src={attachmentPreview.url}
                  controls
                  autoPlay
                  className="max-h-[70vh] w-full rounded-xl border bg-black object-contain"
                />
              ) : (
                <img
                  src={attachmentPreview.url}
                  alt="Attached post media preview"
                  className="max-h-[70vh] w-full rounded-xl border object-contain shadow-sm"
                />
              )}
            </div>
            <DialogFooter className="border-t px-5 py-4">
              <Button variant="outline" onClick={() => setAttachmentPreview(null)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </Dialog>

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

            {hasVisual ? (
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
                <p className="text-xs text-muted-foreground">Replace or regenerate media anytime before you publish.</p>
              </div>
            ) : null}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowPreview(false)}>Close</Button>
          </DialogFooter>
        </div>
      </Dialog>
      <Dialog
        open={showCompletedPost}
        onOpenChange={setShowCompletedPost}
        panelClassName="w-full max-w-2xl p-0"
      >
        {completedPost ? (
          <div className="flex max-h-[92vh] flex-col">
            <DialogHeader className="border-b px-6 py-5">
              <DialogTitle className="flex items-center gap-2">
                {completedPost.errorMessage ? (
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive">!</span>
                ) : completedPost.action === 'schedule' ? (
                  <Calendar className="h-5 w-5 text-primary" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                )}
                {completedPost.errorMessage
                  ? `Publish failed on ${platformLabel(completedPost.platform)}`
                  : completedPost.action === 'now'
                    ? `Posted to ${platformLabel(completedPost.platform)}`
                    : `Scheduled for ${platformLabel(completedPost.platform)}`}
              </DialogTitle>
              <DialogDescription>
                {completedPost.errorMessage
                  ? completedPost.errorMessage
                  : completedPost.action === 'now'
                    ? 'Your post is live. Preview below or open it on the platform.'
                    : `It will publish automatically on ${new Date(completedPost.scheduledAt).toLocaleString()}.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 overflow-y-auto bg-muted/30 px-6 py-5">
              <PlatformPostPreview
                platform={completedPost.platform as PreviewPlatform}
                brandName={brandName}
                content={completedPost.content}
                mediaUrl={
                  completedPost.previewImageUrl ||
                  completedPost.media.find((item) => item.type === 'image')?.url ||
                  completedPost.media[0]?.url ||
                  null
                }
                mediaType={
                  completedPost.media.find((item) => item.type === 'video')
                    ? 'video'
                    : completedPost.media.find((item) => item.type === 'image')
                      ? 'image'
                      : completedPost.previewImageUrl
                        ? 'image'
                        : undefined
                }
                scheduledAt={completedPost.scheduledAt}
                status={completedPost.action === 'schedule' ? 'scheduled' : 'posted'}
              />

              {completedPost.permalinkUrl ? (
                <a
                  href={completedPost.permalinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10"
                >
                  <Link className="h-4 w-4" />
                  View live post on {platformLabel(completedPost.platform)}
                </a>
              ) : completedPost.errorMessage || completedPost.action === 'schedule' ? null : (
                <p className="text-xs text-muted-foreground">
                  Live link will appear here once the platform returns the URL.
                </p>
              )}
            </div>

            <DialogFooter className="border-t bg-background px-6 py-4">
              {completedPost.action === 'schedule' ? (
                <Button variant="outline" onClick={() => navigate('/app/planner')}>
                  Open planner
                </Button>
              ) : (
                <Button variant="outline" onClick={() => navigate('/app/history')}>
                  {APP_PAGE.activityLog}
                </Button>
              )}
              <Button onClick={() => setShowCompletedPost(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : null}
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

