import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { useConfirm } from '@/components/ConfirmProvider'
import { AdsAudienceFields } from '@/components/ads/AdsAudienceFields'
import { AdsCampaignStudio } from '@/components/ads/AdsCampaignStudio'
import { AdsSelectField } from '@/components/ads/AdsSelectField'
import { MetaConnectionFields } from '@/components/ads/MetaConnectionFields'
import type { AdsTargetingSuggestion } from '@/components/ads/AdsTargetingSuggestions'
import { INDUSTRY_OPTIONS } from '@/lib/ads-targeting-options'
import { useAuth } from '@/hooks/useAuth'
import { useAiMediaLibrary } from '@/hooks/useAiMediaLibrary'
import { useWorkspaceIntegrations } from '@/hooks/useWorkspaceIntegrations'
import { APP_PAGE } from '@/lib/app-labels'
import { isDemoMode } from '@/lib/demo'
import { useCredits } from '@/contexts/CreditContext'
import {
  createDefaultAdsStudioProfile,
  emptyPageSections,
  extractPageSections,
  fetchAdsStudioProfile,
  type AdsStudioProfile,
} from '@/lib/ads-studio-profile'
import { syncMetaConnectionFromIntegrations } from '@/lib/meta-connection-sync'
import {
  findFacebookIntegration,
  findMetaAdsIntegration,
  parseFacebookPages,
  parseMetaAdAccounts,
  type MetaPageOption,
} from '@/lib/meta-integration-options'
import { redirectToEdgeFunction, supabase } from '@/lib/supabase'
import { Loader2, Trash2, Upload, Video, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pagination } from '@/components/ui/pagination'
import { Select } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { Json } from '@/types/database'
import { PublishedAdsPanel } from '@/components/ads/PublishedAdsPanel'
import { AdLibraryPanel } from '@/components/ads/AdLibraryPanel'
import { AdsAnalyticsDashboard } from '@/components/ads/AdsAnalyticsDashboard'
import {
  insertAdCreatives,
  updateAdCreative,
  type AdCreativeAudience,
  type AdCreativeBudget,
  type AdCreativeInsert,
  type AdCreativeUpdate,
} from '@/lib/ads-creatives'
import { publishCreativeToMeta } from '@/lib/ads-publish'
import { PublishProgressModal, type PublishPhase } from '@/components/ads/PublishProgressModal'

interface OutletContext {
  currentWorkspaceId: string | null
}

type AdsTab = 'studio' | 'library' | 'media' | 'analytics'
type Goal = 'Get leads' | 'Send traffic to website' | 'Get messages' | 'Increase sales' | 'Boost engagement' | 'Build awareness'
type AdType = 'Single Image Ad' | 'Video Ad' | 'Carousel Ad' | 'Story / Reel Ad' | 'Lead Form Ad' | 'Website Conversion Ad' | 'Engagement Ad'

type AdOption = {
  id: string
  name: string
  primaryText: string
  headline: string
  description?: string
  cta: string
  previewUrl: string | null
  previewType: 'image' | 'video'
  angle?: string
  imagePrompt?: string
  creativeDirection?: string
  targetingAngle?: string
}

type AdRecommendation = { preferredVariant: string; reason: string } | null

type StudioStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

type CampaignDraftState = {
  campaignName: string
  promoting: string
  goal: Goal
  adType: AdType
  audience: string
  location: string
  tone: string
  destinationUrl: string
  dailyBudget: string
  placements: string
  /** Lower bound age (inclusive). 13–65. */
  ageMin: number
  /** Upper bound age (inclusive). 13–65. */
  ageMax: number
  /** Selected genders. Empty array = all genders. */
  genders: string[]
  /** Selected behaviour segments. */
  behaviours: string[]
  /** Campaign start date (YYYY-MM-DD). Empty = start now. */
  scheduleStart: string
  /** Campaign end date (YYYY-MM-DD). Empty = run continuously. */
  scheduleEnd: string
  /** Whether to use a daily or lifetime budget. */
  budgetType: 'daily' | 'lifetime'
  /** Lifetime budget (USD) when budgetType === 'lifetime'. */
  lifetimeBudget: string
  /** Audience size preset hint when the user picks one manually. */
  audienceSize: 'narrow' | 'balanced' | 'broad'
}

function createDefaultCampaignDraft(): CampaignDraftState {
  return {
    campaignName: '',
    promoting: '',
    goal: 'Build awareness',
    adType: 'Single Image Ad',
    audience: '',
    location: '',
    tone: 'Professional and clear',
    destinationUrl: '',
    dailyBudget: '35',
    placements: 'advantage',
    ageMin: 25,
    ageMax: 54,
    genders: [],
    behaviours: [],
    scheduleStart: '',
    scheduleEnd: '',
    budgetType: 'daily',
    lifetimeBudget: '',
    audienceSize: 'balanced',
  }
}

const PERSIST_KEY_PREFIX = 'adguru:campaign-draft:'
// Drafts older than this are considered stale and cleared on load.
const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000
const ADS_MEDIA_PAGE_SIZE = 15

type PersistedCampaignDraft = {
  draft?: Partial<CampaignDraftState>
  options?: AdOption[]
  selectedId?: string | null
  step?: StudioStep
  creativeIdMap?: Record<string, string>
  savedAt?: number
}

function persistKey(workspaceId: string): string {
  return `${PERSIST_KEY_PREFIX}${workspaceId}`
}

function readPersistedCampaignDraft(workspaceId: string): PersistedCampaignDraft | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(persistKey(workspaceId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PersistedCampaignDraft
    if (parsed.savedAt && Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      window.localStorage.removeItem(persistKey(workspaceId))
      return null
    }
    return parsed
  } catch {
    window.localStorage.removeItem(persistKey(workspaceId))
    return null
  }
}

function writePersistedCampaignDraft(workspaceId: string, value: PersistedCampaignDraft): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      persistKey(workspaceId),
      JSON.stringify({ ...value, savedAt: Date.now() }),
    )
  } catch {
    // localStorage may be full or unavailable; ignore.
  }
}

function clearPersistedCampaignDraft(workspaceId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(persistKey(workspaceId))
}

const ONBOARDING_STEPS = [
  'Welcome',
  'Business Profile',
  'Offer / Service',
  'Target Audience',
  'Brand Voice',
  'Lead Destination',
  'Creative Preferences',
  'AI Preferences',
] as const
const CTA_STYLES = ['Book now', 'Learn more', 'Get offer', 'Sign up', 'Message us', 'Get quote', 'Shop now']
const TONES = ['Professional', 'Friendly', 'Bold', 'Luxury', 'Casual', 'Funny', 'Direct response', 'Educational', 'Premium']
const BUSINESS_TYPES = ['Local business', 'Online store', 'Coach / consultant', 'Agency', 'SaaS', 'Restaurant', 'Real estate', 'Fitness', 'Beauty', 'Other']
const VISUAL_STYLES = ['Clean and modern', 'Bold and high-converting', 'Luxury', 'Minimal', 'UGC style', 'Product-focused', 'Lifestyle', 'Cinematic']
const CREATIVE_FORMATS = ['Image ads', 'Video ads', 'Carousel ads', 'Story ads', 'Reel ads', 'UGC-style ads', 'Product promo ads', 'Offer graphics', 'I will upload my own media']

const requiredByStep: Record<number, string[]> = {
  1: [],
  2: ['businessProfile.businessName', 'businessProfile.industry', 'businessProfile.websiteUrl', 'businessProfile.businessType'],
  3: ['offerProfile.mainProductService', 'offerProfile.mainOffer', 'offerProfile.keyBenefits', 'offerProfile.customerProblemSolved'],
  4: ['audienceProfile.description', 'audienceProfile.locations', 'audienceProfile.interests', 'audienceProfile.painPoints', 'audienceProfile.desiredOutcome'],
  5: ['brandVoice.tone', 'brandVoice.writingStyle', 'brandVoice.ctaStyle'],
  6: ['leadDestination.type'],
  7: ['creativePreferences.formats', 'creativePreferences.visualStyle'],
  8: [],
}

export function AdsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { consumeCredits, consumeForFunction } = useCredits()
  const { currentWorkspaceId } = useOutletContext<OutletContext>()
  const { user } = useAuth()
  const { items: mediaItems, remove: removeMedia, refresh: refreshMedia } = useAiMediaLibrary(currentWorkspaceId)
  const { integrations, refresh: refreshIntegrations } = useWorkspaceIntegrations(currentWorkspaceId)
  const [activeTab, setActiveTab] = useState<AdsTab>('studio')
  const [showProfile, setShowProfile] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState(1)
  const [onboardingDone, setOnboardingDone] = useState(false)
  const [showOnboardingComplete, setShowOnboardingComplete] = useState(false)
  const [message, setMessage] = useState('')
  const [aiTip, setAiTip] = useState('')
  const [suggestingAudience, setSuggestingAudience] = useState(false)
  const [generatingCopy, setGeneratingCopy] = useState(false)
  /**
   * Variant IDs whose image / video creative is still being generated. Used to
   * show shimmer placeholders + disable the "Use this ad" CTA so users only see
   * a real ad card once both the copy and media have finished generating.
   */
  const [generatingMediaIds, setGeneratingMediaIds] = useState<string[]>([])
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [mediaPage, setMediaPage] = useState(1)
  const [updatingPostingTarget, setUpdatingPostingTarget] = useState(false)
  /** Bumped after the legacy-asset backfill so the Ad Library re-fetches. */
  const [libraryRefreshToken, setLibraryRefreshToken] = useState(0)
  /**
   * Set when the user picks a Page from the studio "Posting from" toggle that
   * hasn't been onboarded for ads yet. Holds the candidate Page so we can show
   * a confirmation modal before switching, and so the user can choose to
   * either start onboarding for it or cancel the switch.
   */
  const [pendingPageSwitch, setPendingPageSwitch] = useState<{
    pageId: string
    pageName: string
  } | null>(null)
  const [profile, setProfile] = useState<AdsStudioProfile>(() => createDefaultAdsStudioProfile(user?.id ?? ''))
  const [draft, setDraft] = useState<CampaignDraftState>(() => createDefaultCampaignDraft())
  const [options, setOptions] = useState<AdOption[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [studioStep, setStudioStep] = useState<StudioStep>(1)
  const [publishState, setPublishState] = useState<{
    open: boolean
    phase: PublishPhase
    adId?: string | null
    warnings?: string[]
    error?: string | null
  }>({ open: false, phase: 'publishing' })
  const [resumedDraft, setResumedDraft] = useState(false)
  const [targetingSuggestions, setTargetingSuggestions] = useState<AdsTargetingSuggestion[]>([])
  const [variantRecommendation, setVariantRecommendation] = useState<AdRecommendation>(null)
  /** Map ad-option-id → ad_creatives.id so subsequent edits/regens update the same row. */
  const creativeIdByOption = useRef<Record<string, string>>({})
  const currentGenerationId = useRef<string | null>(null)
  /** Guards the one-time legacy-asset backfill so it runs at most once per mount. */
  const legacyBackfillRef = useRef(false)
  const editDebounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const draftHydrated = useRef(false)
  /** Parsed targeting suggestion payload (raw values to apply when the user accepts a card). */
  const pendingApply = useRef<{
    ageMin?: number
    ageMax?: number
    genders?: string[]
    behaviours?: string[]
    audienceSize?: 'narrow' | 'balanced' | 'broad'
    objective?: string
    placements?: string
    adFormat?: string
    dailyBudget?: string
    lifetimeBudget?: string
    locations?: string
    interests?: string
  }>({})

  // Hydrate any saved campaign-in-progress for this workspace on mount.
  useEffect(() => {
    draftHydrated.current = false
    if (!currentWorkspaceId) return
    try {
      const saved = readPersistedCampaignDraft(currentWorkspaceId)
      if (saved) {
        if (saved.draft) setDraft({ ...createDefaultCampaignDraft(), ...saved.draft })
        if (saved.options) setOptions(saved.options)
        if (saved.selectedId !== undefined) setSelectedId(saved.selectedId)
        if (saved.step) setStudioStep(saved.step)
        if (saved.creativeIdMap) creativeIdByOption.current = saved.creativeIdMap
        const isMeaningful =
          (saved.options && saved.options.length > 0) ||
          (saved.draft?.promoting?.trim()?.length ?? 0) > 0 ||
          (saved.step ?? 1) > 1
        if (isMeaningful) setResumedDraft(true)
      }
    } catch (err) {
      console.warn('[AdsPage] failed to hydrate campaign draft', err)
    } finally {
      draftHydrated.current = true
    }
  }, [currentWorkspaceId])

  // Persist the in-flight campaign draft so users can come back without losing progress.
  useEffect(() => {
    if (!currentWorkspaceId || !draftHydrated.current) return
    writePersistedCampaignDraft(currentWorkspaceId, {
      draft,
      options,
      selectedId,
      step: studioStep,
      creativeIdMap: creativeIdByOption.current,
    })
  }, [currentWorkspaceId, draft, options, selectedId, studioStep])

  const resetCampaignDraft = () => {
    setDraft(createDefaultCampaignDraft())
    setOptions([])
    setSelectedId(null)
    setStudioStep(1)
    setResumedDraft(false)
    // Also clear transient AI state so a fresh campaign doesn't inherit the
    // previous one's variants, suggestions, recommendation, or tip.
    setTargetingSuggestions([])
    setVariantRecommendation(null)
    setAiTip('')
    setGeneratingCopy(false)
    setGeneratingMediaIds([])
    creativeIdByOption.current = {}
    if (currentWorkspaceId) clearPersistedCampaignDraft(currentWorkspaceId)
  }

  useEffect(() => {
    if (!user?.id) return
    setProfile((prev) => ({ ...prev, userId: user.id }))
  }, [user?.id])

  useEffect(() => {
    if (!currentWorkspaceId || !user?.id || isDemoMode) return
    const workspaceId = currentWorkspaceId
    const userId = user.id
    let active = true
    async function loadOnboarding() {
      try {
        const saved = await fetchAdsStudioProfile(workspaceId, userId)
        if (!active) return
        if (saved) {
          setProfile(saved)
          const locked = Boolean(saved.onboardingCompleted)
          const legacyComplete = (saved.completionScore ?? 0) >= 70
          setOnboardingDone(locked || legacyComplete)
          if (!locked && !legacyComplete) {
            setOnboardingStep(saved.onboardingStep ? Math.max(1, Math.min(8, saved.onboardingStep)) : 1)
          }
        }
      } catch {
        if (!active) return
      }
    }
    void loadOnboarding()
    return () => {
      active = false
    }
  }, [currentWorkspaceId, user?.id])

  const completion = useMemo(() => {
    const hasBusiness = Boolean(profile.businessProfile.businessName && profile.businessProfile.industry && profile.businessProfile.websiteUrl)
    const hasOffer = Boolean(profile.offerProfile.mainProductService && profile.offerProfile.mainOffer && profile.offerProfile.keyBenefits)
    const hasAudience = Boolean(profile.audienceProfile.description && profile.audienceProfile.locations && profile.audienceProfile.interests)
    const hasVoice = Boolean(profile.brandVoice.tone && profile.brandVoice.writingStyle && profile.brandVoice.ctaStyle)
    const hasDestination = Boolean(profile.leadDestination.type && (profile.leadDestination.type === 'meta_lead_form' || profile.leadDestination.defaultUrl))
    const hasCreative = Boolean(profile.creativePreferences.formats.length && profile.creativePreferences.visualStyle)
    const hasAi = Object.values(profile.aiPreferences).some(Boolean)
    const hasMeta = Boolean(
      profile.metaConnection.facebookPageId || profile.metaConnection.instagramAccountId || profile.metaConnection.adAccountId || profile.metaConnection.connectedAt,
    )
    return (
      (hasBusiness ? 15 : 0) +
      (hasOffer ? 15 : 0) +
      (hasAudience ? 20 : 0) +
      (hasVoice ? 10 : 0) +
      (hasDestination ? 10 : 0) +
      (hasCreative ? 15 : 0) +
      (hasAi ? 10 : 0) +
      (hasMeta ? 5 : 0)
    )
  }, [profile])

  useEffect(() => {
    setProfile((prev) => ({ ...prev, completionScore: completion }))
  }, [completion])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('oauth') === 'facebook' && params.get('status') === 'connected') {
      setMessage('Facebook connected. Your Page, Instagram, and ad accounts should appear below.')
      void refreshIntegrations()
      window.history.replaceState({}, '', location.pathname)
    }
    if (params.get('oauth') === 'meta' && params.get('status') === 'connected') {
      setMessage('Meta Ads connected. Select your ad account below.')
      void refreshIntegrations()
      window.history.replaceState({}, '', location.pathname)
    }
  }, [location.pathname, location.search, refreshIntegrations])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const wantsOnboarding = params.get('onboarding') === '1'
    const wantsEditProfile = params.get('editProfile') === '1'
    if (!wantsOnboarding && !wantsEditProfile) return

    if (wantsOnboarding) {
      // Do not allow forcing onboarding from the URL after it has been completed.
      if (profile.onboardingCompleted) {
        setMessage('Onboarding is already completed. Use Settings → Growth Ads to reset and re-onboard.')
        window.history.replaceState({}, '', location.pathname)
        return
      }
      setOnboardingDone(false)
      setOnboardingStep(1)
      setOptions([])
      setSelectedId(null)
      setMessage('Set up Growth Ads again — complete each onboarding step or skip sections you will fill later.')
      if (currentWorkspaceId && user?.id) {
        void fetchAdsStudioProfile(currentWorkspaceId, user.id).then((saved) => {
          setProfile(saved ?? createDefaultAdsStudioProfile(user.id))
          setOnboardingDone(false)
        })
      } else if (user?.id) {
        setProfile(createDefaultAdsStudioProfile(user.id))
      }
    }

    if (wantsEditProfile) {
      setOnboardingDone(true)
      setShowProfile(true)
      setMessage('Update your Growth Ads AI profile.')
    }

    window.history.replaceState({}, '', location.pathname)
  }, [location.search, currentWorkspaceId, user?.id])

  useEffect(() => {
    if (isDemoMode) return
    setProfile((prev) => {
      const synced = syncMetaConnectionFromIntegrations(prev.metaConnection, integrations)
      if (!synced) return prev
      return {
        ...prev,
        metaConnection: {
          ...synced,
          connectedAt: synced.connectedAt ?? prev.metaConnection.connectedAt ?? new Date().toISOString(),
        },
      }
    })
  }, [integrations])

  useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      campaignName: prev.campaignName || `${profile.businessProfile.businessName || 'My'} Campaign`,
      promoting: prev.promoting || profile.offerProfile.mainOffer,
      audience: prev.audience || profile.audienceProfile.description,
      location: prev.location || profile.audienceProfile.locations,
      tone: prev.tone || profile.brandVoice.tone,
      destinationUrl: prev.destinationUrl || profile.leadDestination.defaultUrl || profile.businessProfile.websiteUrl,
    }))
  }, [
    profile.businessProfile.businessName,
    profile.offerProfile.mainOffer,
    profile.audienceProfile.description,
    profile.audienceProfile.locations,
    profile.brandVoice.tone,
    profile.leadDestination.defaultUrl,
    profile.businessProfile.websiteUrl,
  ])

  const selectedOption = options.find((o) => o.id === selectedId) ?? null
  // Scope ad assets strictly to the Page the user is posting from. Media is
  // tagged with `metadata.facebook_page_id` at generation/upload time, and
  // legacy untagged assets are backfilled to the active Page (see the
  // one-time backfill effect below), so each Page only shows its own assets.
  const adsMedia = useMemo(() => {
    const pageId = profile.metaConnection.facebookPageId || null
    return mediaItems.filter((m) => {
      if (m.source !== 'ads' && m.source !== 'other') return false
      if (!pageId) return true
      const taggedPage = (m.metadata as Record<string, unknown> | null)?.facebook_page_id
      return taggedPage === pageId
    })
  }, [mediaItems, profile.metaConnection.facebookPageId])
  // Clamp the page in render so the user never lands on an empty page when
  // assets are deleted or the workspace switches. Pure computation, no effect.
  const safeMediaPage = Math.min(
    Math.max(1, mediaPage),
    Math.max(1, Math.ceil(adsMedia.length / ADS_MEDIA_PAGE_SIZE)),
  )
  const visibleAdsMedia = useMemo(
    () => adsMedia.slice((safeMediaPage - 1) * ADS_MEDIA_PAGE_SIZE, safeMediaPage * ADS_MEDIA_PAGE_SIZE),
    [adsMedia, safeMediaPage],
  )

  // Available Facebook Pages parsed from the active integration. Demo mode
  // (or a missing integration) falls back to whatever is on the saved profile,
  // so the studio still works without a connected Page list.
  const facebookPagesForToggle = useMemo<MetaPageOption[]>(() => {
    const fb = findFacebookIntegration(integrations)
    const pages = parseFacebookPages(fb)
    if (pages.length > 0) return pages
    if (profile.metaConnection.facebookPageId) {
      return [
        {
          id: profile.metaConnection.facebookPageId,
          name: profile.businessProfile.businessName || 'Connected Page',
        },
      ]
    }
    return []
  }, [integrations, profile.metaConnection.facebookPageId, profile.businessProfile.businessName])

  /**
   * Name shown in the studio sidebar / preview as the posting Page label.
   * We prefer the live Facebook Page name from the integration so it reflects
   * the "Posting from" toggle in real time; we only fall back to the saved
   * brand business name when no Page is connected.
   */
  const selectedFacebookPageName =
    facebookPagesForToggle.find((page) => page.id === profile.metaConnection.facebookPageId)?.name ??
    profile.businessProfile.businessName

  const recommendedTypes = useMemo(() => {
    if (draft.goal === 'Get leads' && profile.leadDestination.type === 'meta_lead_form') return ['Lead Form Ad', 'Video Ad', 'Single Image Ad']
    if (draft.goal === 'Send traffic to website' && (profile.leadDestination.defaultUrl || profile.businessProfile.websiteUrl)) {
      return ['Website Conversion Ad', 'Single Image Ad', 'Carousel Ad']
    }
    return ['Single Image Ad', 'Video Ad', 'Carousel Ad']
  }, [draft.goal, profile.leadDestination.type, profile.leadDestination.defaultUrl, profile.businessProfile.websiteUrl])

  const connectMeta = () => {
    if (isDemoMode) return setMessage('Demo mode: Meta connected.')
    void redirectToEdgeFunction('meta-oauth-start', {
      workspace_id: currentWorkspaceId,
      return_to: '/app/ads?oauth=meta&status=connected',
    })
  }

  const connectFacebook = () => {
    if (isDemoMode) return setMessage('Demo mode: Facebook connected.')
    void redirectToEdgeFunction('facebook-oauth-start', {
      workspace_id: currentWorkspaceId,
      return_to: '/app/ads?oauth=facebook&status=connected',
    })
  }

  const refreshMetaConnections = () => {
    if (isDemoMode) {
      setMessage('Demo mode: connections refreshed.')
      return
    }
    const facebookIntegration = findFacebookIntegration(integrations)
    const metaIntegration = findMetaAdsIntegration(integrations)
    if (parseMetaAdAccounts(metaIntegration, facebookIntegration).length > 0) {
      void refreshIntegrations()
      setMessage('Meta connections refreshed.')
      return
    }
    setMessage('Reconnecting Facebook to sync Pages, Instagram, and ad accounts…')
    connectFacebook()
  }

  const saveProfile = async (patch?: Partial<AdsStudioProfile>) => {
    if (!currentWorkspaceId || !user?.id) return
    const payload: AdsStudioProfile = {
      ...profile,
      ...(patch ?? {}),
      userId: user.id,
      updatedAt: new Date().toISOString(),
      createdAt: profile.createdAt || new Date().toISOString(),
    }
    const { error: upsertError } = await supabase.from('meta_ads_onboarding').upsert(
      {
        workspace_id: currentWorkspaceId,
        user_id: user.id,
        answers: payload as unknown as Json,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'user_id,workspace_id' },
    )
    if (upsertError) {
      console.error('[AdsPage] saveProfile upsert failed', upsertError)
      setMessage(`Could not save profile: ${upsertError.message}`)
      return
    }
    setProfile(payload)
    if (showProfile) {
      setShowProfile(false)
      setMessage('AI Profile saved.')
    }
  }

  /**
   * Persist the page switch to both the saved profile and the integration
   * metadata used by the `meta-ads` edge function. Optionally enters the
   * onboarding flow for the new Page when `restartOnboarding` is true.
   */
  /**
   * Build the profile patch for switching the active Facebook Page WITHOUT
   * losing any other Page's onboarding answers. We snapshot the current Page's
   * sections into `pageProfiles`, then load the target Page's saved snapshot
   * (or blank sections when starting a fresh onboarding) into the top-level
   * working fields.
   */
  const buildPageSwitchPatch = (
    pageId: string,
    restartOnboarding: boolean,
  ): { patch: Partial<AdsStudioProfile>; onboardingCompleted: boolean; onboardingStep: number } => {
    const userId = user?.id ?? profile.userId
    const currentPageId = profile.metaConnection.facebookPageId

    // 1. Snapshot the Page we're leaving so its answers are preserved.
    const pageProfiles = { ...(profile.pageProfiles ?? {}) }
    if (currentPageId) {
      pageProfiles[currentPageId] = extractPageSections(profile)
    }

    // 2. Resolve the target Page's sections.
    const savedTarget = pageProfiles[pageId]
    const targetSections =
      restartOnboarding || !savedTarget ? emptyPageSections(userId) : savedTarget
    // A restart always begins onboarding fresh; an existing snapshot keeps its
    // own completion flag.
    const onboardingCompleted = restartOnboarding ? false : targetSections.onboardingCompleted
    const onboardingStep = restartOnboarding ? 1 : targetSections.onboardingStep

    const patch: Partial<AdsStudioProfile> = {
      pageProfiles,
      businessProfile: targetSections.businessProfile,
      offerProfile: targetSections.offerProfile,
      audienceProfile: targetSections.audienceProfile,
      brandVoice: targetSections.brandVoice,
      leadDestination: targetSections.leadDestination,
      creativePreferences: targetSections.creativePreferences,
      onboardingCompleted,
      onboardingStep,
      metaConnection: {
        ...profile.metaConnection,
        facebookPageId: pageId,
        connectedAt: new Date().toISOString(),
      },
    }
    return { patch, onboardingCompleted, onboardingStep }
  }

  const applyFacebookPageSwitch = async (
    pageId: string,
    pageName: string,
    options: { restartOnboarding?: boolean } = {},
  ) => {
    const restartOnboarding = options.restartOnboarding ?? false
    const { patch, onboardingCompleted, onboardingStep } = buildPageSwitchPatch(
      pageId,
      restartOnboarding,
    )

    if (isDemoMode) {
      setProfile((prev) => ({ ...prev, ...patch }))
      setOnboardingDone(onboardingCompleted)
      setOnboardingStep(onboardingStep)
      setMessage(
        restartOnboarding
          ? `Switched to ${pageName} (demo). Complete onboarding to start posting ads.`
          : `Posting from ${pageName} (demo).`,
      )
      return
    }

    setUpdatingPostingTarget(true)
    try {
      const facebookIntegration = findFacebookIntegration(integrations)
      if (facebookIntegration) {
        const nextMetadata = {
          ...(facebookIntegration.metadata ?? {}),
          selected_page_id: pageId,
          page_id: pageId,
          page_name: pageName,
        }
        const { error: integrationError } = await supabase
          .from('user_integrations')
          .update({ metadata: nextMetadata } as never)
          .eq('id', facebookIntegration.id)
        if (integrationError) {
          setMessage(`Could not switch Page: ${integrationError.message}`)
          return
        }
        void refreshIntegrations()
      }
      await saveProfile(patch)
      setOnboardingDone(onboardingCompleted)
      setOnboardingStep(onboardingStep)
      setMessage(
        restartOnboarding
          ? `Switched to ${pageName}. Complete onboarding to start posting ads from this Page.`
          : `Now posting from ${pageName}.`,
      )
    } finally {
      setUpdatingPostingTarget(false)
    }
  }

  /**
   * Top-level handler wired to the studio "Posting from" dropdown. Routes the
   * user through a confirmation modal when they pick a Page that has not been
   * onboarded yet so they can't publish ads from a Page that hasn't gone
   * through the brand / audience / offer setup.
   */
  const changeFacebookPostingPage = async (pageId: string) => {
    if (!pageId || pageId === profile.metaConnection.facebookPageId) return
    const nextPage = facebookPagesForToggle.find((page) => page.id === pageId)
    const pageName = nextPage?.name ?? pageId
    const onboardedPageIds = profile.onboardedPageIds ?? []
    const isOnboarded = onboardedPageIds.includes(pageId)

    // First-ever onboarding hasn't even been completed, so just let them move
    // around — they're still in the wizard for whatever Page they were on.
    if (!profile.onboardingCompleted) {
      await applyFacebookPageSwitch(pageId, pageName)
      return
    }

    if (!isOnboarded) {
      setPendingPageSwitch({ pageId, pageName })
      return
    }

    await applyFacebookPageSwitch(pageId, pageName)
  }

  const confirmStartOnboardingForPendingPage = async () => {
    if (!pendingPageSwitch) return
    const { pageId, pageName } = pendingPageSwitch
    setPendingPageSwitch(null)
    await applyFacebookPageSwitch(pageId, pageName, { restartOnboarding: true })
  }

  /**
   * One-time migration for assets created before per-Page tagging existed.
   * Any ad creative or ad media asset without a Facebook Page id is assigned to
   * the Page the user currently has selected, so Pages stop sharing the same
   * legacy assets. New assets are always tagged on creation, so this query is
   * naturally idempotent (it finds nothing once everything has a Page).
   */
  const backfillUntaggedAssetsToPage = useCallback(
    async (pageId: string) => {
      if (!currentWorkspaceId || isDemoMode) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      try {
        await sb
          .from('ad_creatives')
          .update({ facebook_page_id: pageId })
          .eq('workspace_id', currentWorkspaceId)
          .is('facebook_page_id', null)

        const { data } = await sb
          .from('workspace_ai_media')
          .select('id, metadata, source')
          .eq('workspace_id', currentWorkspaceId)
          .in('source', ['ads', 'other'])
        const untagged = ((data ?? []) as Array<{ id: string; metadata: Record<string, unknown> | null }>).filter(
          (row) => !row.metadata?.facebook_page_id,
        )
        await Promise.all(
          untagged.map((row) =>
            sb
              .from('workspace_ai_media')
              .update({ metadata: { ...(row.metadata ?? {}), facebook_page_id: pageId } })
              .eq('id', row.id),
          ),
        )

        if (untagged.length > 0) {
          await refreshMedia()
        }
        setLibraryRefreshToken((token) => token + 1)
      } catch (err) {
        console.warn('[AdsPage] legacy asset backfill failed', err)
      }
    },
    [currentWorkspaceId, refreshMedia],
  )

  useEffect(() => {
    if (legacyBackfillRef.current || isDemoMode) return
    const pageId = profile.metaConnection.facebookPageId
    if (!currentWorkspaceId || !pageId || !onboardingDone) return
    legacyBackfillRef.current = true
    void backfillUntaggedAssetsToPage(pageId)
  }, [currentWorkspaceId, profile.metaConnection.facebookPageId, onboardingDone, backfillUntaggedAssetsToPage])

  const suggestAudienceWithAi = async (goalOverride?: string) => {
    setSuggestingAudience(true)
    setMessage('')
    const applySuggestion = (data: Record<string, unknown>) => {
      const interestList = Array.isArray(data.interests)
        ? (data.interests as string[])
        : typeof data.interests === 'string'
          ? (data.interests as string)
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
          : []
      const interests = interestList.join(', ')

      const behaviourList = Array.isArray(data.behaviours)
        ? (data.behaviours as string[])
        : typeof data.behaviours === 'string'
          ? (data.behaviours as string)
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
          : []

      const ageRangeText = String(data.age_range || '')
      const ageMinRaw = Number(data.age_min)
      const ageMaxRaw = Number(data.age_max)
      const [parsedMin, parsedMax] = ageRangeText.split(/[-–]/).map((n) => Number(n.replace(/[^\d]/g, '')))
      const ageMin = Number.isFinite(ageMinRaw) && ageMinRaw > 0
        ? ageMinRaw
        : Number.isFinite(parsedMin) && parsedMin > 0
          ? parsedMin
          : undefined
      const ageMax = Number.isFinite(ageMaxRaw) && ageMaxRaw > 0
        ? ageMaxRaw
        : Number.isFinite(parsedMax) && parsedMax > 0
          ? parsedMax
          : undefined

      const genderRaw = String(data.gender || '').toLowerCase()
      const genders =
        genderRaw === 'women' || genderRaw === 'female'
          ? ['Women']
          : genderRaw === 'men' || genderRaw === 'male'
            ? ['Men']
            : []

      const audienceSize = (() => {
        const raw = String(data.audience_size || '').toLowerCase()
        if (raw === 'narrow' || raw === 'broad' || raw === 'balanced') return raw
        return undefined
      })()

      const placements = typeof data.placements === 'string' ? data.placements : undefined
      const objective = typeof data.objective === 'string' ? data.objective : undefined
      const adFormat = typeof data.ad_format === 'string' ? data.ad_format : undefined
      const dailyBudgetSuggestion = Number(data.daily_budget)
      const lifetimeBudgetSuggestion = Number(data.lifetime_budget)
      const durationDays = Number(data.duration_days)
      const reasons = (data.reasons && typeof data.reasons === 'object'
        ? (data.reasons as Record<string, string>)
        : {})

      setProfile((prev) => ({
        ...prev,
        audienceProfile: {
          ...prev.audienceProfile,
          description: String(data.audience_description || prev.audienceProfile.description),
          // Keep the user's chosen location — only fall back to the AI's when
          // none is set. Location is still offered as an applyable suggestion.
          locations: prev.audienceProfile.locations || String(data.locations || ''),
          ageRange: ageRangeText || prev.audienceProfile.ageRange,
          gender: String(data.gender || prev.audienceProfile.gender),
          interests: interests || prev.audienceProfile.interests,
          painPoints: String(data.pain_points || prev.audienceProfile.painPoints),
          desiredOutcome: String(data.desired_outcome || prev.audienceProfile.desiredOutcome),
        },
      }))
      setDraft((prev) => ({
        ...prev,
        audience: String(data.audience_description || prev.audience),
        location: prev.location || String(data.locations || ''),
      }))
      if (typeof data.ai_tip === 'string') setAiTip(data.ai_tip)

      // Build per-field suggestion cards with reasoning.
      const suggestions: AdsTargetingSuggestion[] = []
      if (ageMin && ageMax) {
        suggestions.push({
          field: 'age',
          title: 'Recommended age range',
          value: `${ageMin}–${ageMax}`,
          reasoning: reasons.age || 'Best fit based on who is most likely to buy this offer.',
        })
      }
      suggestions.push({
        field: 'gender',
        title: 'Recommended gender targeting',
        value: genders.length === 0 ? 'All genders' : genders.join(', '),
        reasoning: reasons.gender || 'Broad gender targeting unless your offer is gender-specific.',
      })
      if (typeof data.locations === 'string' && data.locations) {
        suggestions.push({
          field: 'locations',
          title: 'Recommended locations',
          value: String(data.locations),
          reasoning: reasons.locations || 'Targets your active service area first; you can expand later.',
        })
      }
      if (interestList.length > 0) {
        suggestions.push({
          field: 'interests',
          title: 'Recommended interests',
          value: interestList.slice(0, 6).join(', '),
          reasoning: reasons.interests || 'Picked to match your offer and customer mindset.',
        })
      }
      if (behaviourList.length > 0) {
        suggestions.push({
          field: 'behaviours',
          title: 'Recommended behaviours',
          value: behaviourList.slice(0, 4).join(', '),
          reasoning: reasons.behaviours || 'Behaviour segments most likely to act on this offer.',
        })
      }
      if (audienceSize) {
        suggestions.push({
          field: 'audienceSize',
          title: 'Recommended audience size',
          value: audienceSize.charAt(0).toUpperCase() + audienceSize.slice(1),
          reasoning: reasons.audience_size || 'Best balance between specificity and reach for your goal.',
        })
      }
      if (objective) {
        suggestions.push({
          field: 'objective',
          title: 'Recommended objective',
          value: objective,
          reasoning: reasons.objective || 'Aligned with your business model and offer type.',
        })
      }
      if (placements) {
        suggestions.push({
          field: 'placements',
          title: 'Recommended placements',
          value: placements,
          reasoning: reasons.placements || 'Where your audience is most active and converts best.',
        })
      }
      if (Number.isFinite(dailyBudgetSuggestion) && dailyBudgetSuggestion > 0) {
        const dur = Number.isFinite(durationDays) && durationDays > 0 ? durationDays : 7
        suggestions.push({
          field: 'budget',
          title: 'Recommended starting budget',
          value: `$${Math.round(dailyBudgetSuggestion)}/day for ${dur} days`,
          reasoning: reasons.budget || 'Enough volume to collect learning data without overspending early.',
        })
      } else if (Number.isFinite(lifetimeBudgetSuggestion) && lifetimeBudgetSuggestion > 0) {
        suggestions.push({
          field: 'budget',
          title: 'Recommended starting budget',
          value: `$${Math.round(lifetimeBudgetSuggestion)} lifetime`,
          reasoning: reasons.budget || 'Total spend that should produce useful learnings for this campaign.',
        })
      }
      setTargetingSuggestions(suggestions)

      // Stash parsed structured values for apply handlers to consume.
      pendingApply.current = {
        ageMin,
        ageMax,
        genders,
        behaviours: behaviourList,
        audienceSize,
        objective,
        placements,
        adFormat,
        dailyBudget: Number.isFinite(dailyBudgetSuggestion) && dailyBudgetSuggestion > 0 ? String(Math.round(dailyBudgetSuggestion)) : undefined,
        lifetimeBudget: Number.isFinite(lifetimeBudgetSuggestion) && lifetimeBudgetSuggestion > 0 ? String(Math.round(lifetimeBudgetSuggestion)) : undefined,
        locations: typeof data.locations === 'string' ? data.locations : undefined,
        interests,
      }
      setMessage('AI targeting recommendations ready. Apply any individually or all at once.')
    }

    if (isDemoMode) {
      applySuggestion({
        audience_description: `People interested in ${profile.offerProfile.mainProductService || 'your offer'} near ${profile.audienceProfile.locations || 'your area'}.`,
        locations: profile.audienceProfile.locations || 'Australia — Brisbane',
        age_range: '25-54',
        gender: 'All',
        interests: ['Small business owners', 'Online shopping', profile.businessProfile.industry || 'Marketing'].filter(Boolean),
        pain_points: profile.offerProfile.customerProblemSolved || 'They need a trusted provider with clear pricing.',
        desired_outcome: draft.goal === 'Get leads' ? 'Submit a lead form or message you' : 'Visit your website and take action',
        ai_tip: 'Start with Advantage+ placements and a $35/day budget for 7 days, then narrow by best-performing age group.',
      })
      setSuggestingAudience(false)
      return
    }

    if (!currentWorkspaceId) {
      setSuggestingAudience(false)
      return setMessage('Select a workspace to use AI suggestions.')
    }

    const gate = await consumeForFunction('suggest-ads-targeting', {}, { workspaceId: currentWorkspaceId })
    if (!gate.ok) {
      setSuggestingAudience(false)
      return setMessage(gate.error ?? 'Insufficient credits.')
    }

    const { data, error } = await supabase.functions.invoke('suggest-ads-targeting', {
      body: {
        workspace_id: currentWorkspaceId,
        goal: goalOverride ?? draft.goal,
        business_profile: profile.businessProfile,
        offer_profile: profile.offerProfile,
      },
    })
    setSuggestingAudience(false)
    if (error) return setMessage(error.message)
    if (data?.error) return setMessage(String(data.error))
    applySuggestion(data as Record<string, unknown>)
  }

  const markSuggestionApplied = (field: AdsTargetingSuggestion['field']) => {
    setTargetingSuggestions((list) =>
      list.map((s) => (s.field === field ? { ...s, applied: true } : s)),
    )
  }

  const applyTargetingSuggestion = (suggestion: AdsTargetingSuggestion) => {
    const pending = pendingApply.current
    switch (suggestion.field) {
      case 'age':
        if (pending.ageMin && pending.ageMax) {
          setDraft((prev) => ({ ...prev, ageMin: pending.ageMin!, ageMax: pending.ageMax! }))
        }
        break
      case 'gender':
        setDraft((prev) => ({ ...prev, genders: pending.genders ?? [] }))
        break
      case 'locations':
        if (pending.locations) {
          setDraft((prev) => ({ ...prev, location: pending.locations! }))
          setProfile((prev) => ({
            ...prev,
            audienceProfile: { ...prev.audienceProfile, locations: pending.locations! },
          }))
        }
        break
      case 'interests':
        if (pending.interests) {
          setProfile((prev) => ({
            ...prev,
            audienceProfile: { ...prev.audienceProfile, interests: pending.interests! },
          }))
        }
        break
      case 'behaviours':
        setDraft((prev) => ({ ...prev, behaviours: pending.behaviours ?? [] }))
        break
      case 'audienceSize':
        if (pending.audienceSize) {
          setDraft((prev) => ({ ...prev, audienceSize: pending.audienceSize! }))
        }
        break
      case 'objective':
        if (pending.objective) {
          setDraft((prev) => ({ ...prev, goal: pending.objective as Goal }))
        }
        break
      case 'placements':
        if (pending.placements) {
          setDraft((prev) => ({ ...prev, placements: pending.placements! }))
        }
        break
      case 'budget':
        if (pending.dailyBudget) {
          setDraft((prev) => ({ ...prev, budgetType: 'daily', dailyBudget: pending.dailyBudget! }))
        } else if (pending.lifetimeBudget) {
          setDraft((prev) => ({ ...prev, budgetType: 'lifetime', lifetimeBudget: pending.lifetimeBudget! }))
        }
        break
    }
    markSuggestionApplied(suggestion.field)
  }

  const applyAllTargetingSuggestions = () => {
    targetingSuggestions.forEach((suggestion) => applyTargetingSuggestion(suggestion))
    setMessage('AI targeting applied. You can still edit any field manually.')
  }

  const generateOptions = async () => {
    if (!draft.promoting.trim()) {
      setMessage('Add what you are promoting before generating ads.')
      return
    }
    setGeneratingCopy(true)
    const previewType: 'image' | 'video' = draft.adType === 'Video Ad' ? 'video' : 'image'
    if (isDemoMode) {
      const demo: AdOption[] = [
        {
          id: `demo-A`,
          name: 'Variant A',
          angle: 'direct-offer',
          primaryText: `${profile.offerProfile.mainOffer || 'Your offer'} — built for ${draft.audience || 'your audience'}. Get the result you've been after, fast.`,
          headline: `${profile.businessProfile.businessName || 'Your brand'} — ${profile.offerProfile.mainProductService || 'Offer'}`,
          description: 'Booked in minutes. No surprises.',
          cta: profile.brandVoice.ctaStyle || 'Learn more',
          previewUrl: null,
          previewType,
          creativeDirection: 'Bright hero shot of the product or service in use.',
          targetingAngle: 'High-intent buyers ready to act now.',
        },
        {
          id: `demo-B`,
          name: 'Variant B',
          angle: 'problem-solution',
          primaryText: `Tired of ${profile.audienceProfile.painPoints || 'the usual problem'}? ${profile.offerProfile.mainOffer || 'Our offer'} solves it without the usual hassle. Here's how →`,
          headline: 'A better way to solve this',
          description: 'Most people don\'t know this exists.',
          cta: 'Get Offer',
          previewUrl: null,
          previewType,
          creativeDirection: 'Before / after layout — bold contrast.',
          targetingAngle: 'People who have tried alternatives and are frustrated.',
        },
      ]
      setOptions(demo)
      setSelectedId(demo[0].id)
      setVariantRecommendation({
        preferredVariant: 'Variant A',
        reason: 'Variant A has a clearer offer and a stronger direct CTA likely to win in cold audiences.',
      })
      setGeneratingCopy(false)
      return
    }
    if (!currentWorkspaceId && !isDemoMode) {
      setGeneratingCopy(false)
      return setMessage('Select a workspace to generate ads.')
    }
    if (!isDemoMode) {
      const gate = await consumeCredits('ad_copy', { workspaceId: currentWorkspaceId })
      if (!gate.ok) {
        setGeneratingCopy(false)
        return setMessage(gate.error ?? 'Insufficient credits.')
      }
    }
    const { data, error } = await supabase.functions.invoke('generate-ad-copy', {
      body: {
        brief: [
          `Business: ${profile.businessProfile.businessName}`,
          `Industry: ${profile.businessProfile.industry}`,
          `Offer: ${profile.offerProfile.mainOffer}`,
          `Benefits: ${profile.offerProfile.keyBenefits}`,
          `Audience: ${draft.audience}`,
          `Pain points: ${profile.audienceProfile.painPoints}`,
          `Desired outcome: ${profile.audienceProfile.desiredOutcome}`,
          `Tone: ${profile.brandVoice.tone}`,
          `Writing style: ${profile.brandVoice.writingStyle}`,
          `CTA style: ${profile.brandVoice.ctaStyle}`,
          `Words to avoid: ${profile.brandVoice.wordsToAvoid}`,
          `Creative style: ${profile.creativePreferences.visualStyle}`,
          `Campaign goal: ${draft.goal}`,
        ].join('\n'),
        workspace_id: currentWorkspaceId,
      },
    })
    setGeneratingCopy(false)
    if (error) return setMessage(error.message)
    const rawVariants = (data?.variants as Array<Record<string, unknown>>) ?? []
    const next: AdOption[] = rawVariants.slice(0, 2).map((v, i) => ({
      id: crypto.randomUUID(),
      name: typeof v.name === 'string' && v.name ? v.name : `Variant ${String.fromCharCode(65 + i)}`,
      primaryText: String(v.primary_text || ''),
      headline: String(v.headline || ''),
      description: typeof v.description === 'string' ? v.description : undefined,
      cta: String(v.cta || 'Learn More'),
      previewUrl: null,
      previewType,
      angle: typeof v.angle === 'string' ? v.angle : undefined,
      imagePrompt: typeof v.image_prompt === 'string' ? v.image_prompt : undefined,
      creativeDirection: typeof v.creative_direction === 'string' ? v.creative_direction : undefined,
      targetingAngle: typeof v.targeting_angle === 'string' ? v.targeting_angle : undefined,
    }))
    setOptions(next)
    setSelectedId(next[0]?.id ?? null)
    const rec = data?.recommendation as { preferred_variant?: string; reason?: string } | undefined
    const recommendation: AdRecommendation = rec?.preferred_variant
      ? { preferredVariant: String(rec.preferred_variant), reason: String(rec.reason || '') }
      : null
    setVariantRecommendation(recommendation)

    if (currentWorkspaceId && user?.id) {
      try {
        const generationId = crypto.randomUUID()
        currentGenerationId.current = generationId
        const rows: AdCreativeInsert[] = next.map((option, idx) => ({
          ...buildCreativePayload(option),
          workspace_id: currentWorkspaceId,
          user_id: user.id,
          facebook_page_id: profile.metaConnection.facebookPageId || null,
          generation_id: generationId,
          variant_label: option.name,
          is_selected_variant: idx === 0,
          status: 'ai_draft',
          source: 'ai',
          ai_recommendation: recommendation
            ? { preferred_variant: recommendation.preferredVariant, reason: recommendation.reason }
            : {},
        }))
        const inserted = await insertAdCreatives(rows)
        creativeIdByOption.current = {}
        inserted.forEach((row, idx) => {
          const localId = next[idx]?.id
          if (localId) creativeIdByOption.current[localId] = row.id
        })
      } catch (err) {
        console.warn('[AdsPage] failed to persist variants to ad_creatives', err)
      }
    }

    setGeneratingMediaIds(next.map((option) => option.id))
    void Promise.allSettled(
      next.map((option) => generateMediaForVariant(option.id, previewType, { option })),
    )
  }

  /** Snapshot of the current draft + a variant into an ad_creatives column shape. */
  const buildCreativePayload = (option: AdOption): AdCreativeUpdate => {
    const audience: AdCreativeAudience = {
      location: draft.location || null,
      age_min: draft.ageMin,
      age_max: draft.ageMax,
      genders: draft.genders ?? [],
      interests: profile.audienceProfile.interests?.split(',').map((s) => s.trim()).filter(Boolean) ?? [],
      behaviours: draft.behaviours ?? [],
      audience_size: draft.audienceSize,
    }
    const budget: AdCreativeBudget = {
      type: draft.budgetType,
      daily: draft.budgetType === 'daily' ? Number(draft.dailyBudget) || null : null,
      lifetime: draft.budgetType === 'lifetime' ? Number(draft.lifetimeBudget) || null : null,
      duration_days:
        draft.scheduleStart && draft.scheduleEnd
          ? Math.max(
              1,
              Math.round(
                (new Date(draft.scheduleEnd).getTime() - new Date(draft.scheduleStart).getTime()) /
                  86400000,
              ) + 1,
            )
          : null,
    }
    return {
      campaign_name: draft.campaignName || null,
      angle: option.angle ?? null,
      primary_text: option.primaryText,
      headline: option.headline,
      description: option.description ?? null,
      cta: option.cta,
      media_url: option.previewUrl ?? null,
      media_type: option.previewType,
      image_prompt: option.imagePrompt ?? null,
      creative_direction: option.creativeDirection ?? null,
      targeting_angle: option.targetingAngle ?? null,
      destination_url: draft.destinationUrl || null,
      destination_type: profile.leadDestination.type ?? null,
      goal: draft.goal ?? null,
      placements: Array.isArray(draft.placements) ? draft.placements : [],
      ad_format: draft.adType ?? null,
      audience,
      budget,
      schedule_start: draft.scheduleStart || null,
      schedule_end: draft.scheduleEnd || null,
    }
  }

  /** Update the row that backs the given AdOption (debounced for inline edits). */
  const persistOptionPatch = (optionId: string, debounceMs = 0) => {
    const creativeId = creativeIdByOption.current[optionId]
    if (!creativeId) return
    if (editDebounceTimers.current[optionId]) {
      clearTimeout(editDebounceTimers.current[optionId])
    }
    const run = async () => {
      const option = options.find((o) => o.id === optionId)
      if (!option) return
      try {
        await updateAdCreative(creativeId, buildCreativePayload(option))
      } catch (err) {
        console.warn('[AdsPage] failed to update ad_creatives row', err)
      }
    }
    if (debounceMs <= 0) {
      void run()
      return
    }
    editDebounceTimers.current[optionId] = setTimeout(run, debounceMs)
  }

  const regenerateVariant = async (variantId: string) => {
    const existing = options.find((option) => option.id === variantId)
    if (!existing) return
    const previewType: 'image' | 'video' = draft.adType === 'Video Ad' ? 'video' : 'image'
    if (isDemoMode) {
      const fresh: AdOption = {
        ...existing,
        primaryText: `${existing.primaryText.split('.')[0]}. Here's a fresh take — punchier opening and a tighter promise.`,
        headline: `${existing.headline} ✦`,
      }
      setOptions((list) => list.map((o) => (o.id === variantId ? fresh : o)))
      return
    }
    if (!currentWorkspaceId) {
      return setMessage('Select a workspace to regenerate this variant.')
    }
    const gate = await consumeCredits('ad_copy', { workspaceId: currentWorkspaceId })
    if (!gate.ok) return setMessage(gate.error ?? 'Insufficient credits.')

    const { data, error } = await supabase.functions.invoke('generate-ad-copy', {
      body: {
        brief: [
          `Business: ${profile.businessProfile.businessName}`,
          `Offer: ${profile.offerProfile.mainOffer}`,
          `Audience: ${draft.audience}`,
          `Tone: ${profile.brandVoice.tone}`,
          `Campaign goal: ${draft.goal}`,
          `Replacing variant: ${existing.name} (was ${existing.angle || 'unknown'} angle). Use a NEW angle.`,
        ].join('\n'),
        workspace_id: currentWorkspaceId,
        regenerate_variant_index: 0,
      },
    })
    if (error) return setMessage(error.message)
    const v = ((data?.variants as Array<Record<string, unknown>>) ?? [])[0]
    if (!v) return setMessage('Could not regenerate this variant. Try again.')
    setOptions((list) =>
      list.map((option) =>
        option.id === variantId
          ? {
              ...option,
              primaryText: String(v.primary_text || option.primaryText),
              headline: String(v.headline || option.headline),
              description: typeof v.description === 'string' ? v.description : option.description,
              cta: String(v.cta || option.cta),
              previewType,
              angle: typeof v.angle === 'string' ? v.angle : option.angle,
              imagePrompt: typeof v.image_prompt === 'string' ? v.image_prompt : option.imagePrompt,
              creativeDirection: typeof v.creative_direction === 'string' ? v.creative_direction : option.creativeDirection,
              targetingAngle: typeof v.targeting_angle === 'string' ? v.targeting_angle : option.targetingAngle,
            }
          : option,
      ),
    )
    persistOptionPatch(variantId)
  }

  const handleRemoveMedia = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete this asset?',
      description: 'It will be removed from your Growth Ads media library.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    })
    if (!confirmed) return
    await removeMedia(id)
    void refreshMedia()
  }

  /**
   * Generate an image / video creative for a single ad variant. Used both when
   * `generateOptions` first creates variants (so the user gets text + media in
   * one click) and when the user manually clicks "Regenerate image / video"
   * inside the editor. Handles per-variant loading state, credit gating, and
   * persistence so the rest of the UI can simply observe `generatingMediaIds`.
   */
  const generateMediaForVariant = async (
    optionId: string,
    type: 'image' | 'video',
    overrides?: { promptOverride?: string; option?: AdOption },
  ) => {
    if (!currentWorkspaceId || !user?.id) return
    // Prefer the passed-in option (avoids stale-closure issues when called
    // immediately after a setOptions) and fall back to the current state.
    const baseOption = overrides?.option ?? options.find((o) => o.id === optionId)
    if (!baseOption) return
    const fn = type === 'image' ? 'generate-image' : 'generate-video'
    setGeneratingMediaIds((ids) => (ids.includes(optionId) ? ids : [...ids, optionId]))
    try {
      if (!isDemoMode) {
        const gate = await consumeForFunction(fn, { premium: false }, { workspaceId: currentWorkspaceId })
        if (!gate.ok) {
          setMessage(gate.error ?? 'Insufficient credits.')
          return
        }
      }
      const prompt =
        overrides?.promptOverride ||
        baseOption.imagePrompt ||
        baseOption.creativeDirection ||
        `${baseOption.headline}. ${baseOption.primaryText}`
      if (isDemoMode) {
        await new Promise((resolve) => setTimeout(resolve, 900 + Math.random() * 600))
        const seed = encodeURIComponent(`${baseOption.id}-${type}`)
        const demoUrl =
          type === 'video'
            ? 'https://download.samplelib.com/mp4/sample-5s.mp4'
            : `https://picsum.photos/seed/${seed}/800/800`
        setOptions((list) =>
          list.map((o) =>
            o.id === optionId ? { ...o, previewUrl: demoUrl, previewType: type } : o,
          ),
        )
        return
      }
      const { data, error } = await supabase.functions.invoke(fn, {
        body: {
          prompt,
          platform: 'facebook',
          workspace_id: currentWorkspaceId,
          user_id: user.id,
          source: 'ads',
          metadata: {
            adOptionId: optionId,
            campaignId: draft.campaignName || null,
            facebook_page_id: profile.metaConnection.facebookPageId || null,
          },
        },
      })
      if (error) {
        setMessage(error.message)
        return
      }
      if (data?.url) {
        const url = data.url as string
        setOptions((list) =>
          list.map((o) => (o.id === optionId ? { ...o, previewUrl: url, previewType: type } : o)),
        )
        const creativeId = creativeIdByOption.current[optionId]
        if (creativeId) {
          try {
            await updateAdCreative(creativeId, { media_url: url, media_type: type })
          } catch (err) {
            console.warn('[AdsPage] failed to persist generated media to ad_creatives', err)
          }
        }
        void refreshMedia()
      }
    } catch (err) {
      console.warn('[AdsPage] media generation failed', err)
    } finally {
      setGeneratingMediaIds((ids) => ids.filter((id) => id !== optionId))
    }
  }

  const generateCreative = async (type: 'image' | 'video') => {
    if (!selectedOption) return
    await generateMediaForVariant(selectedOption.id, type)
  }

  const validateCurrentStep = () => {
    const required = requiredByStep[onboardingStep] ?? []
    const missing = required.filter((path) => !readPath(profile, path))
    if (missing.length > 0) {
      setMessage('Please complete required fields before moving forward.')
      return false
    }
    return true
  }

  const nextOnboarding = () => {
    if (!validateCurrentStep()) return
    const nextStep = Math.min(8, onboardingStep + 1)
    setOnboardingStep(nextStep)
    setMessage('')
    void saveProfile({ onboardingStep: nextStep })
  }

  const skipOnboarding = () => {
    const nextStep = Math.min(8, onboardingStep + 1)
    setOnboardingStep(nextStep)
    setMessage('')
    void saveProfile({ onboardingStep: nextStep })
  }

  /**
   * Upload a brand logo from the user's device, store it in the AI library
   * (so it shows up in the AI Vault under Pictures), and save its public URL
   * onto the Ads profile's creative preferences.
   */
  const uploadLogoToLibrary = async (file: File | undefined | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage('Please choose an image file for your logo.')
      return
    }

    if (isDemoMode) {
      const localUrl = URL.createObjectURL(file)
      setProfile((p) => ({
        ...p,
        creativePreferences: { ...p.creativePreferences, logoUrl: localUrl },
      }))
      setMessage('Logo added (demo).')
      return
    }

    if (!currentWorkspaceId || !user?.id) {
      setMessage('Select a workspace before uploading a logo.')
      return
    }

    setUploadingLogo(true)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${currentWorkspaceId}/${user.id}/${Date.now()}_${safeName}`
      const { error: uploadError } = await supabase.storage.from('ai_library').upload(path, file)
      if (uploadError) {
        setMessage(uploadError.message)
        return
      }
      const { data } = supabase.storage.from('ai_library').getPublicUrl(path)
      const publicUrl = data.publicUrl
      const { error: insertError } = await supabase.from('workspace_ai_media').insert({
        workspace_id: currentWorkspaceId,
        created_by: user.id,
        media_type: 'image',
        storage_bucket: 'ai_library',
        storage_path: path,
        public_url: publicUrl,
        prompt: 'Brand logo',
        source: 'ads',
        metadata: {
          kind: 'logo',
          source: 'upload',
          facebook_page_id: profile.metaConnection.facebookPageId || null,
        },
      } as never)
      if (insertError) {
        setMessage(insertError.message)
        return
      }
      const nextCreative = { ...profile.creativePreferences, logoUrl: publicUrl }
      await saveProfile({ creativePreferences: nextCreative })
      void refreshMedia()
      setMessage('Logo uploaded and saved to your library under Pictures.')
    } finally {
      setUploadingLogo(false)
    }
  }

  const completeOnboarding = () => {
    setOnboardingDone(true)
    setShowOnboardingComplete(true)
    setMessage('')
    // Track the Page this onboarding was completed for so the "Posting from"
    // toggle can detect when the user later switches to a Page that hasn't
    // been onboarded yet.
    const currentPageId = profile.metaConnection.facebookPageId
    const existingOnboardedPageIds = profile.onboardedPageIds ?? []
    const onboardedPageIds = currentPageId && !existingOnboardedPageIds.includes(currentPageId)
      ? [...existingOnboardedPageIds, currentPageId]
      : existingOnboardedPageIds
    // Snapshot the just-completed answers against this Page so switching away
    // and back (or onboarding another Page) never overwrites them.
    const pageProfiles = { ...(profile.pageProfiles ?? {}) }
    if (currentPageId) {
      pageProfiles[currentPageId] = {
        ...extractPageSections(profile),
        onboardingCompleted: true,
        onboardingStep: 8,
      }
    }
    void saveProfile({
      onboardingCompleted: true,
      onboardingStep: 8,
      onboardedPageIds,
      pageProfiles,
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 alive-enter">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{APP_PAGE.growthAds}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Facebook-style campaign builder with AI audience, copy, and creative help.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={profile.metaConnection.adAccountId ? 'default' : 'secondary'}>
            {profile.metaConnection.adAccountId ? 'Meta connected' : 'Meta not connected'}
          </Badge>
          <Button variant="outline" onClick={() => setShowProfile(true)}>Edit AI Profile</Button>
          <Button variant="outline" onClick={() => navigate('/app/settings', { state: { tab: 'accounts' } })}>
            Manage connections
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Growth Ads Profile {completion}% complete</Badge>
        {!onboardingDone ? (
          <Badge variant="secondary" className="alive-soft-pulse">
            Step {onboardingStep} active
          </Badge>
        ) : null}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="alive-shimmer h-full rounded-full bg-primary/35" style={{ width: `${Math.max(8, completion)}%` }} />
      </div>

      {onboardingDone && facebookPagesForToggle.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-muted/20 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Posting from
            </p>
            <p className="text-sm">
              Ads published from this studio will appear on the Facebook Page you choose here.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Label htmlFor="ads-posting-page" className="text-xs text-muted-foreground">
              Facebook Page
            </Label>
            <Select
              id="ads-posting-page"
              value={profile.metaConnection.facebookPageId || ''}
              onChange={(event) => void changeFacebookPostingPage(event.target.value)}
              disabled={updatingPostingTarget || facebookPagesForToggle.length <= 1}
              className="min-w-[12rem]"
            >
              {profile.metaConnection.facebookPageId ? null : (
                <option value="">Select a Page</option>
              )}
              {facebookPagesForToggle.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.name}
                </option>
              ))}
            </Select>
            {facebookPagesForToggle.length <= 1 ? (
              <p className="text-[11px] text-muted-foreground">
                Only one Page connected.{' '}
                <button
                  type="button"
                  onClick={refreshMetaConnections}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  Refresh
                </button>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {message ? <div className="rounded-xl border bg-primary/5 px-4 py-3 text-sm">{message}</div> : null}

      <Dialog
        open={showOnboardingComplete}
        onOpenChange={setShowOnboardingComplete}
        panelClassName="w-full max-w-lg p-6"
      >
        <DialogHeader>
          <DialogTitle>Your Growth Ads AI Profile is ready</DialogTitle>
          <DialogDescription>
            Growth Ads will use your business, audience, offer, and creative preferences to generate better campaigns.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 rounded-2xl border bg-muted/20 p-4">
          <p className="text-sm font-medium">Growth Ads Profile: {completion}% complete</p>
          <p className="mt-1 text-xs text-muted-foreground">
            You can edit this anytime via <span className="font-medium text-foreground">Edit AI Profile</span>.
          </p>
        </div>
        <DialogFooter className="mt-5 gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => {
              setShowOnboardingComplete(false)
              setOnboardingDone(true)
            }}
          >
            Go to Growth Ads
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={() => {
              setShowOnboardingComplete(false)
              setOnboardingDone(true)
            }}
          >
            Create first Meta ad
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog
        open={pendingPageSwitch !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPageSwitch(null)
        }}
        panelClassName="w-full max-w-md p-6"
      >
        <DialogHeader>
          <DialogTitle>Onboarding required for this Page</DialogTitle>
          <DialogDescription>
            {pendingPageSwitch
              ? `${pendingPageSwitch.pageName} hasn't gone through Growth Ads onboarding yet. You'll need to complete the onboarding process — business, offer, audience, brand voice, and creative preferences — before you can publish ads to this Page.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 rounded-2xl border bg-amber-500/5 px-4 py-3 text-sm">
          <p className="font-medium text-amber-700 dark:text-amber-300">
            Why this matters
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Each Facebook Page can target a different audience and brand voice. Completing onboarding for{' '}
            {pendingPageSwitch?.pageName ?? 'this Page'} keeps every ad on-brand and lets the AI tailor copy and
            creatives to the right audience.
          </p>
        </div>
        <DialogFooter className="mt-5 gap-2 sm:gap-2">
          <Button
            variant="ghost"
            className="w-full sm:w-auto"
            onClick={() => setPendingPageSwitch(null)}
          >
            Stay on current Page
          </Button>
          <Button
            className="w-full sm:w-auto"
            disabled={updatingPostingTarget}
            onClick={() => void confirmStartOnboardingForPendingPage()}
          >
            Start onboarding
          </Button>
        </DialogFooter>
      </Dialog>

      {!onboardingDone ? (
        <Card className="alive-enter">
          <CardHeader>
            <CardTitle>{ONBOARDING_STEPS[onboardingStep - 1]}</CardTitle>
            <CardDescription>Meta Connected to Growth Ads Onboarding to Growth Ads Ready</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Step {onboardingStep} of 8</span>
                <span>{completion}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="alive-shimmer h-2 rounded-full bg-primary transition-all" style={{ width: `${Math.max(10, (onboardingStep / 8) * 100)}%` }} />
              </div>
            </div>

            {onboardingStep === 1 ? (
              <MetaConnectionFields
                value={profile.metaConnection}
                onChange={(next) =>
                  setProfile((prev) => ({
                    ...prev,
                    metaConnection: {
                      ...prev.metaConnection,
                      ...next,
                      connectedAt: next.connectedAt ?? prev.metaConnection.connectedAt ?? new Date().toISOString(),
                    },
                  }))
                }
                integrations={integrations}
                isDemoMode={isDemoMode}
                onConnectFacebook={connectFacebook}
                onConnectMeta={connectMeta}
                onRefreshConnections={refreshMetaConnections}
              />
            ) : null}

            {onboardingStep === 2 ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Field required label="Business name" value={profile.businessProfile.businessName} onChange={(v) => setProfile((p) => ({ ...p, businessProfile: { ...p.businessProfile, businessName: v } }))} />
                <AdsSelectField
                  label="Industry / niche"
                  required
                  value={profile.businessProfile.industry}
                  onChange={(industry) => setProfile((p) => ({ ...p, businessProfile: { ...p.businessProfile, industry } }))}
                  options={INDUSTRY_OPTIONS}
                  placeholder="Select your industry"
                />
                <Field required label="Website URL" value={profile.businessProfile.websiteUrl} onChange={(v) => setProfile((p) => ({ ...p, businessProfile: { ...p.businessProfile, websiteUrl: v } }))} />
                <div className="grid gap-1.5">
                  <Label>Business type *</Label>
                  <Select value={profile.businessProfile.businessType} onChange={(e) => setProfile((p) => ({ ...p, businessProfile: { ...p.businessProfile, businessType: e.target.value } }))}>
                    <option value="">Select type</option>
                    {BUSINESS_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground md:col-span-2">This helps AI generate strategy, audiences, and ad copy specific to your business.</p>
              </div>
            ) : null}

            {onboardingStep === 3 ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Field required label="Main product or service" value={profile.offerProfile.mainProductService} onChange={(v) => setProfile((p) => ({ ...p, offerProfile: { ...p.offerProfile, mainProductService: v } }))} />
                <Field required label="Main offer" value={profile.offerProfile.mainOffer} onChange={(v) => setProfile((p) => ({ ...p, offerProfile: { ...p.offerProfile, mainOffer: v } }))} />
                <Field label="Price point (optional)" value={profile.offerProfile.pricePoint} onChange={(v) => setProfile((p) => ({ ...p, offerProfile: { ...p.offerProfile, pricePoint: v } }))} />
                <Field required label="Key benefits" value={profile.offerProfile.keyBenefits} onChange={(v) => setProfile((p) => ({ ...p, offerProfile: { ...p.offerProfile, keyBenefits: v } }))} multiline />
                <div className="md:col-span-2">
                  <Field required label="Main customer problem solved" value={profile.offerProfile.customerProblemSolved} onChange={(v) => setProfile((p) => ({ ...p, offerProfile: { ...p.offerProfile, customerProblemSolved: v } }))} multiline />
                </div>
              </div>
            ) : null}

            {onboardingStep === 4 ? (
              <AdsAudienceFields
                value={profile.audienceProfile}
                onChange={(audienceProfile) => setProfile((p) => ({ ...p, audienceProfile }))}
                onSuggestAi={() => suggestAudienceWithAi()}
                aiLoading={suggestingAudience}
              />
            ) : null}

            {onboardingStep === 5 ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Brand tone *</Label>
                  <Select value={profile.brandVoice.tone} onChange={(e) => setProfile((p) => ({ ...p, brandVoice: { ...p.brandVoice, tone: e.target.value } }))}>
                    {TONES.map((tone) => <option key={tone} value={tone}>{tone}</option>)}
                  </Select>
                </div>
                <Field required label="Writing style" value={profile.brandVoice.writingStyle} onChange={(v) => setProfile((p) => ({ ...p, brandVoice: { ...p.brandVoice, writingStyle: v } }))} />
                <div className="grid gap-1.5">
                  <Label>CTA style *</Label>
                  <Select value={profile.brandVoice.ctaStyle} onChange={(e) => setProfile((p) => ({ ...p, brandVoice: { ...p.brandVoice, ctaStyle: e.target.value } }))}>
                    {CTA_STYLES.map((cta) => <option key={cta} value={cta}>{cta}</option>)}
                  </Select>
                </div>
                <Field label="Words to avoid (optional)" value={profile.brandVoice.wordsToAvoid} onChange={(v) => setProfile((p) => ({ ...p, brandVoice: { ...p.brandVoice, wordsToAvoid: v } }))} multiline />
              </div>
            ) : null}

            {onboardingStep === 6 ? (
              <div className="space-y-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <button type="button" onClick={() => setProfile((p) => ({ ...p, leadDestination: { ...p.leadDestination, type: 'custom_url' } }))} className={`rounded-xl border p-3 text-left ${profile.leadDestination.type === 'custom_url' ? 'border-primary bg-primary/5' : ''}`}>
                    <p className="font-medium">My Own URL</p>
                    <p className="text-xs text-muted-foreground">Send traffic to your website, booking page, checkout, or existing form.</p>
                  </button>
                  <button type="button" onClick={() => setProfile((p) => ({ ...p, leadDestination: { ...p.leadDestination, type: 'meta_lead_form' } }))} className={`rounded-xl border p-3 text-left ${profile.leadDestination.type === 'meta_lead_form' ? 'border-primary bg-primary/5' : ''}`}>
                    <p className="font-medium">Meta Lead Form</p>
                    <p className="text-xs text-muted-foreground">Collect leads inside Facebook and Instagram using instant forms.</p>
                  </button>
                </div>
                <Field label="Default destination URL" value={profile.leadDestination.defaultUrl} onChange={(v) => setProfile((p) => ({ ...p, leadDestination: { ...p.leadDestination, defaultUrl: v } }))} />
                <p className="text-xs text-muted-foreground">No CRM setup, lead routing, or external pipelines are included here.</p>
              </div>
            ) : null}

            {onboardingStep === 7 ? (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {CREATIVE_FORMATS.map((format) => (
                    <label key={format} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={profile.creativePreferences.formats.includes(format)}
                        onChange={(e) =>
                          setProfile((p) => ({
                            ...p,
                            creativePreferences: {
                              ...p.creativePreferences,
                              formats: e.target.checked
                                ? [...p.creativePreferences.formats, format]
                                : p.creativePreferences.formats.filter((item) => item !== format),
                            },
                          }))
                        }
                      />
                      {format}
                    </label>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label>Preferred visual style *</Label>
                    <Select value={profile.creativePreferences.visualStyle} onChange={(e) => setProfile((p) => ({ ...p, creativePreferences: { ...p.creativePreferences, visualStyle: e.target.value } }))}>
                      {VISUAL_STYLES.map((style) => <option key={style} value={style}>{style}</option>)}
                    </Select>
                  </div>
                  <Field label="Brand colours (optional)" value={profile.creativePreferences.brandColors} onChange={(v) => setProfile((p) => ({ ...p, creativePreferences: { ...p.creativePreferences, brandColors: v } }))} />
                  <div className="grid gap-1.5">
                    <Label>Logo (optional)</Label>
                    <div className="flex items-center gap-3">
                      {profile.creativePreferences.logoUrl ? (
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-muted/30">
                          <img
                            src={profile.creativePreferences.logoUrl}
                            alt="Brand logo"
                            className="h-full w-full object-contain"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setProfile((p) => ({
                                ...p,
                                creativePreferences: { ...p.creativePreferences, logoUrl: '' },
                              }))
                            }
                            className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                            aria-label="Remove logo"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed bg-muted/20 text-[10px] text-muted-foreground">
                          No logo
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-2">
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            void uploadLogoToLibrary(e.target.files?.[0])
                            e.target.value = ''
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingLogo}
                          onClick={() => logoInputRef.current?.click()}
                        >
                          {uploadingLogo ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="mr-2 h-4 w-4" />
                          )}
                          {uploadingLogo ? 'Uploading…' : 'Upload logo'}
                        </Button>
                        <Input
                          placeholder="…or paste a logo URL"
                          value={profile.creativePreferences.logoUrl}
                          onChange={(e) =>
                            setProfile((p) => ({
                              ...p,
                              creativePreferences: { ...p.creativePreferences, logoUrl: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Uploads are saved to your AI Vault under Pictures.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {onboardingStep === 8 ? (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(profile.aiPreferences).map(([key, value]) => (
                    <label key={key} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                      <span>{formatAiKey(key)}</span>
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => setProfile((p) => ({ ...p, aiPreferences: { ...p.aiPreferences, [key]: e.target.checked } }))}
                      />
                    </label>
                  ))}
                </div>
                <Card className="bg-primary/5">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium">Completion score: {completion}%</p>
                    <p className="text-xs text-muted-foreground">This profile is used by ad copy, creative generation, audience suggestions, budget recommendations, and analytics.</p>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <Button
                variant="outline"
                disabled={onboardingStep === 1}
                onClick={() => {
                  const prevStep = Math.max(1, onboardingStep - 1)
                  setOnboardingStep(prevStep)
                  void saveProfile({ onboardingStep: prevStep })
                }}
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => void saveProfile()}>Save</Button>
                <Button variant="outline" onClick={skipOnboarding}>Skip</Button>
                {onboardingStep < 8 ? (
                  <Button onClick={nextOnboarding}>Next</Button>
                ) : (
                  <Button onClick={completeOnboarding}>Build My Growth Ads Profile</Button>
                )}
              </div>
            </div>

            {onboardingDone ? (
              <Card className="border-primary/40 bg-primary/5">
                <CardHeader>
                  <CardTitle>Your Growth Ads AI Profile is ready</CardTitle>
                  <CardDescription>Ad Guru can now generate smarter Meta campaigns using your business, audience, offer, and creative style.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm font-medium">Growth Ads Profile: {completion}% Complete</p>
                  <div className="grid gap-2 sm:grid-cols-2 text-sm">
                    <p>Business Profile</p><p>Offer</p><p>Audience</p><p>Brand Voice</p><p>Destination</p><p>Creative Preferences</p><p>AI Optimization</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setOnboardingDone(true)}>Go to Growth Ads</Button>
                    <Button variant="outline" onClick={() => setOnboardingStep(2)}>Complete Missing Details</Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Tabs>
        <TabsList className="mb-4">
          <TabsTrigger value="studio" activeValue={activeTab} onClick={() => setActiveTab('studio')}>Studio</TabsTrigger>
          <TabsTrigger value="library" activeValue={activeTab} onClick={() => setActiveTab('library')}>Ad Library</TabsTrigger>
          <TabsTrigger value="media" activeValue={activeTab} onClick={() => setActiveTab('media')}>Media Library</TabsTrigger>
          <TabsTrigger value="analytics" activeValue={activeTab} onClick={() => setActiveTab('analytics')}>Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="studio" activeValue={activeTab}>
          {resumedDraft ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-primary/5 px-4 py-3 text-sm">
              <p>
                <span className="font-medium">Resumed your campaign in progress.</span>{' '}
                Pick up where you left off or start fresh.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Start a new campaign?',
                    description:
                      'This will clear your current campaign draft, ad options, and any AI-generated creatives for this workspace. This action cannot be undone.',
                    confirmLabel: 'Start over',
                    variant: 'destructive',
                  })
                  if (ok) resetCampaignDraft()
                }}
              >
                Start over
              </Button>
            </div>
          ) : null}
          <AdsCampaignStudio
            draft={{
              campaignName: draft.campaignName,
              promoting: draft.promoting,
              goal: draft.goal,
              adType: draft.adType,
              audience: draft.audience,
              location: draft.location,
              tone: draft.tone,
              destinationUrl: draft.destinationUrl,
              dailyBudget: draft.dailyBudget,
              placements: draft.placements,
              ageMin: draft.ageMin,
              ageMax: draft.ageMax,
              genders: draft.genders,
              behaviours: draft.behaviours,
              scheduleStart: draft.scheduleStart,
              scheduleEnd: draft.scheduleEnd,
              budgetType: draft.budgetType,
              lifetimeBudget: draft.lifetimeBudget,
              audienceSize: draft.audienceSize,
            }}
            onDraftChange={(patch) =>
              setDraft((d) => {
                const next = { ...d, ...patch }
                return {
                  ...next,
                  goal: (patch.goal ?? d.goal) as Goal,
                  adType: (patch.adType ?? d.adType) as AdType,
                }
              })
            }
            audienceProfile={profile.audienceProfile}
            onAudienceProfileChange={(audienceProfile) => {
              setProfile((p) => ({ ...p, audienceProfile }))
              // Pass the new value as a patch — a bare saveProfile() reads the
              // stale profile closure and would re-save the previous location
              // (e.g. revert Gold Coast back to Australia).
              void saveProfile({ audienceProfile })
            }}
            businessName={selectedFacebookPageName}
            defaultDestinationUrl={profile.leadDestination.defaultUrl || profile.businessProfile.websiteUrl}
            destinationType={profile.leadDestination.type}
            brandTone={profile.brandVoice.tone}
            brandCta={profile.brandVoice.ctaStyle}
            recommendedAdTypes={recommendedTypes}
            facebookPageId={profile.metaConnection.facebookPageId || null}
            options={options}
            selectedId={selectedId}
            onSelectOption={(id) => {
              setSelectedId(id)
              const creativeId = creativeIdByOption.current[id]
              if (creativeId) {
                Object.entries(creativeIdByOption.current).forEach(([optId, cid]) => {
                  if (cid && cid !== creativeId) {
                    void updateAdCreative(cid, { is_selected_variant: false })
                  } else if (cid === creativeId) {
                    void updateAdCreative(cid, { is_selected_variant: true, status: 'draft' })
                  }
                  return optId
                })
              }
            }}
            onUpdateOption={(id, patch) => {
              setOptions((list) => list.map((o) => (o.id === id ? { ...o, ...patch } : o)))
              persistOptionPatch(id, 600)
            }}
            onGenerateOptions={generateOptions}
            onRegenerateVariant={regenerateVariant}
            variantRecommendation={variantRecommendation}
            onGenerateCreative={generateCreative}
            onUploadImage={async (optionId, file) => {
              if (!currentWorkspaceId || !user?.id) {
                setMessage('Pick a workspace before uploading an image.')
                return
              }
              try {
                const safeName = file.name.replace(/[^\w.-]+/g, '_')
                const path = `${currentWorkspaceId}/${user.id}/ad_${Date.now()}_${safeName}`
                const { data, error } = await supabase.storage.from('media').upload(path, file)
                if (error || !data) {
                  setMessage(`Image upload failed: ${error?.message ?? 'unknown error'}`)
                  return
                }
                const url = supabase.storage.from('media').getPublicUrl(data.path).data.publicUrl
                setOptions((list) =>
                  list.map((o) => (o.id === optionId ? { ...o, previewUrl: url, previewType: 'image' } : o)),
                )
                const creativeId = creativeIdByOption.current[optionId]
                if (creativeId) {
                  await updateAdCreative(creativeId, { media_url: url, media_type: 'image' })
                }
              } catch (err) {
                setMessage(err instanceof Error ? err.message : 'Image upload failed.')
              }
            }}
            onSuggestAudience={() => suggestAudienceWithAi()}
            targetingSuggestions={targetingSuggestions}
            onApplyTargetingSuggestion={applyTargetingSuggestion}
            onApplyAllTargetingSuggestions={applyAllTargetingSuggestions}
            onEditProfile={() => setShowProfile(true)}
            generatingCopy={generatingCopy}
            generatingMediaIds={generatingMediaIds}
            suggestingAudience={suggestingAudience}
            aiTip={aiTip}
            metaReady={Boolean(profile.metaConnection.adAccountId && profile.metaConnection.facebookPageId)}
            onPublish={async () => {
              const creativeId = selectedId ? creativeIdByOption.current[selectedId] : null
              if (!creativeId) {
                setPublishState({ open: true, phase: 'error', error: 'Generate or select an ad variant before publishing.' })
                return
              }
              if (!currentWorkspaceId) {
                setPublishState({ open: true, phase: 'error', error: 'Pick a workspace before publishing.' })
                return
              }
              const adAccountId = profile.metaConnection.adAccountId
              if (!adAccountId) {
                setPublishState({
                  open: true,
                  phase: 'error',
                  error: 'Connect a Meta ad account in Settings → Connections before publishing.',
                })
                return
              }
              setPublishState({ open: true, phase: 'publishing' })
              const result = await publishCreativeToMeta({
                creativeId,
                workspaceId: currentWorkspaceId,
                metaAccountId: `act_${adAccountId.replace(/^act_/, '')}`,
              })
              if (!result.ok) {
                setPublishState({ open: true, phase: 'error', error: result.error ?? 'Unknown error' })
                return
              }
              setPublishState({ open: true, phase: 'success', adId: result.ad_id, warnings: result.warnings })
            }}
            step={studioStep}
            onStepChange={setStudioStep}
            onReset={async () => {
              const ok = await confirm({
                title: 'Start a new campaign?',
                description:
                  'This will clear your current campaign draft, ad options, and any AI-generated creatives for this workspace.',
                confirmLabel: 'Start over',
                variant: 'destructive',
              })
              if (ok) resetCampaignDraft()
            }}
          />

          <PublishProgressModal
            open={publishState.open}
            phase={publishState.phase}
            adId={publishState.adId}
            warnings={publishState.warnings}
            error={publishState.error}
            adsManagerUrl={
              profile.metaConnection.adAccountId
                ? `https://www.facebook.com/adsmanager/manage/ads?act=${profile.metaConnection.adAccountId.replace(/^act_/, '')}`
                : null
            }
            onClose={() => setPublishState((s) => ({ ...s, open: false }))}
            onViewLibrary={() => {
              setPublishState((s) => ({ ...s, open: false }))
              setActiveTab('library')
            }}
            onStartNew={() => {
              setPublishState((s) => ({ ...s, open: false }))
              resetCampaignDraft()
            }}
            onReconnect={() => {
              setPublishState((s) => ({ ...s, open: false }))
              connectFacebook()
            }}
          />
        </TabsContent>

        <TabsContent value="library" activeValue={activeTab}>
          <AdLibraryPanel
            workspaceId={currentWorkspaceId}
            businessName={selectedFacebookPageName}
            facebookPageId={profile.metaConnection.facebookPageId || null}
            refreshToken={libraryRefreshToken}
            onOpenInStudio={(creative) => {
              setActiveTab('studio')
              setDraft((d) => ({
                ...d,
                campaignName: creative.campaign_name ?? d.campaignName,
                goal: (creative.goal as Goal) ?? d.goal,
                adType: (creative.ad_format as AdType) ?? d.adType,
                destinationUrl: creative.destination_url ?? d.destinationUrl,
                location: creative.audience?.location ?? d.location,
                ageMin: creative.audience?.age_min ?? d.ageMin,
                ageMax: creative.audience?.age_max ?? d.ageMax,
                genders: (creative.audience?.genders as string[]) ?? d.genders,
                behaviours: (creative.audience?.behaviours as string[]) ?? d.behaviours,
                audienceSize: creative.audience?.audience_size ?? d.audienceSize,
                budgetType: creative.budget?.type ?? d.budgetType,
                dailyBudget:
                  typeof creative.budget?.daily === 'number'
                    ? String(creative.budget.daily)
                    : d.dailyBudget,
                lifetimeBudget:
                  typeof creative.budget?.lifetime === 'number'
                    ? String(creative.budget.lifetime)
                    : d.lifetimeBudget,
                scheduleStart: creative.schedule_start ?? d.scheduleStart,
                scheduleEnd: creative.schedule_end ?? d.scheduleEnd,
                placements: Array.isArray(creative.placements) && creative.placements.length > 0
                  ? creative.placements.join(',')
                  : d.placements,
              }))
              const reusedOption: AdOption = {
                id: creative.id,
                name: creative.variant_label || 'Variant A',
                primaryText: creative.primary_text,
                headline: creative.headline,
                description: creative.description ?? undefined,
                cta: creative.cta,
                previewUrl: creative.media_url ?? null,
                previewType: (creative.media_type as 'image' | 'video') ?? 'image',
                angle: creative.angle ?? undefined,
                imagePrompt: creative.image_prompt ?? undefined,
                creativeDirection: creative.creative_direction ?? undefined,
                targetingAngle: creative.targeting_angle ?? undefined,
              }
              setOptions([reusedOption])
              setSelectedId(reusedOption.id)
              creativeIdByOption.current = { [reusedOption.id]: creative.id }
              currentGenerationId.current = creative.generation_id
              setStudioStep(4)
            }}
          />
        </TabsContent>

        <TabsContent value="media" activeValue={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle>Media Library</CardTitle>
              <CardDescription>Reusable AI and uploaded ad assets.</CardDescription>
            </CardHeader>
            <CardContent>
              {adsMedia.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assets yet.</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {visibleAdsMedia.map((asset) => (
                      <div
                        key={asset.id}
                        className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
                      >
                        <div className="relative aspect-square w-full overflow-hidden bg-muted">
                          {asset.media_type === 'video' ? (
                            <video src={asset.public_url} muted playsInline className="h-full w-full object-cover" />
                          ) : (
                            <img src={asset.public_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                          )}
                          {asset.media_type === 'video' ? (
                            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
                              <Video className="h-3 w-3" />
                              Video
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1.5 p-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 flex-1 text-xs"
                            onClick={() => {
                              void navigator.clipboard.writeText(asset.public_url)
                              setMessage('Asset URL copied to clipboard.')
                            }}
                          >
                            Reuse
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            title="Delete"
                            onClick={() => void handleRemoveMedia(asset.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Pagination
                    totalItems={adsMedia.length}
                    pageSize={ADS_MEDIA_PAGE_SIZE}
                    page={safeMediaPage}
                    onPageChange={setMediaPage}
                    itemLabel="assets"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" activeValue={activeTab}>
          <div className="space-y-4">
            <AdsAnalyticsDashboard
              workspaceId={currentWorkspaceId}
              facebookPageId={profile.metaConnection.facebookPageId || null}
            />
            <PublishedAdsPanel
              workspaceId={currentWorkspaceId}
              metaAccountId={profile?.metaConnection?.adAccountId ? `act_${profile.metaConnection.adAccountId.replace(/^act_/, '')}` : null}
            />
            <Card>
              <CardHeader>
                <CardTitle>Forecast for this campaign</CardTitle>
                <CardDescription>Estimates based on the current campaign draft.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Est. spend (7d)" value={`$${(Number(draft.dailyBudget || 35) * 7).toFixed(0)}`} />
                <Metric label="Est. impressions" value={`${Math.round(Number(draft.dailyBudget || 35) * 120 * 7)}`} />
                <Metric label="Est. clicks" value={`${Math.round(Number(draft.dailyBudget || 35) * 1.8 * 7)}`} />
                <Metric label="CTR" value="1.8%" />
                <Metric label="CPC" value="$1.90" />
                <Metric label="Leads" value={`${Math.max(1, Math.round(Number(draft.dailyBudget || 35) / 18))}`} />
                <Metric label="ROAS" value="2.4x" />
                <Metric label="Video views" value={`${Math.round(Number(draft.dailyBudget || 35) * 15)}`} />
                <Metric label="AI suggestion" value="Test a pain-point hook" />
                <Metric label="AI suggestion" value="Narrow interests 15%" />
                <Metric label="AI suggestion" value="Use stronger CTA overlay" />
                <Metric label="AI suggestion" value={profile.leadDestination.type === 'custom_url' ? 'Try Meta Lead Form test' : 'Test faster follow-up CTA'} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      )}

      <Dialog
        open={showProfile}
        onOpenChange={setShowProfile}
        panelClassName="flex w-full max-w-2xl flex-col"
      >
        <DialogHeader className="border-b px-6 pb-4 pt-6 text-left">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle>Edit AI Profile</DialogTitle>
              <DialogDescription>
                Short context AI Guru uses to write better ads. Fill out as much or as little as you want — you can
                always finish it later from the onboarding flow.
              </DialogDescription>
            </div>
            <Badge variant="outline" className="shrink-0">
              {completion}% complete
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Business</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Business name"
                value={profile.businessProfile.businessName}
                onChange={(v) =>
                  setProfile((p) => ({ ...p, businessProfile: { ...p.businessProfile, businessName: v } }))
                }
              />
              <Field
                label="Website"
                value={profile.businessProfile.websiteUrl}
                onChange={(v) =>
                  setProfile((p) => ({ ...p, businessProfile: { ...p.businessProfile, websiteUrl: v } }))
                }
              />
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Audience</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Audience description"
                value={profile.audienceProfile.description}
                onChange={(v) =>
                  setProfile((p) => ({ ...p, audienceProfile: { ...p.audienceProfile, description: v } }))
                }
                multiline
              />
              <Field
                label="Location"
                value={profile.audienceProfile.locations}
                onChange={(v) =>
                  setProfile((p) => ({ ...p, audienceProfile: { ...p.audienceProfile, locations: v } }))
                }
              />
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Offer & Voice</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Offer / product"
                value={profile.offerProfile.mainOffer}
                onChange={(v) =>
                  setProfile((p) => ({ ...p, offerProfile: { ...p.offerProfile, mainOffer: v } }))
                }
              />
              <Field
                label="Tone"
                value={profile.brandVoice.tone}
                onChange={(v) => setProfile((p) => ({ ...p, brandVoice: { ...p.brandVoice, tone: v } }))}
              />
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Destination</p>
            <Field
              label="Landing URL"
              value={profile.leadDestination.defaultUrl}
              onChange={(v) =>
                setProfile((p) => ({ ...p, leadDestination: { ...p.leadDestination, defaultUrl: v } }))
              }
            />
          </section>
        </div>

        <DialogFooter className="gap-2 border-t bg-muted/20 px-6 py-3 sm:gap-2">
          <Button variant="ghost" onClick={() => setShowProfile(false)}>
            Cancel
          </Button>
          <Button onClick={() => void saveProfile()}>Save Profile</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  required = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  required?: boolean
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}{required ? ' *' : ''}</Label>
      {multiline ? <Textarea value={value} onChange={(e) => onChange(e.target.value)} /> : <Input value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}

function formatAiKey(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (letter) => letter.toUpperCase())
}

function readPath(object: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) return (acc as Record<string, unknown>)[part]
    return ''
  }, object)
}
/* import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { BarChart3, Link, Sparkles, Wand2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAiMediaLibrary } from '@/hooks/useAiMediaLibrary'
import { isDemoMode } from '@/lib/demo'
import { redirectToEdgeFunction, supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { Json } from '@/types/database'

interface OutletContext {
  currentWorkspaceId: string | null
}

type AdsTab = 'studio' | 'media' | 'analytics'
type GoalOption =
  | 'Get leads'
  | 'Send traffic to website'
  | 'Get messages'
  | 'Increase sales'
  | 'Boost engagement'
  | 'Build awareness'
type AdType =
  | 'Single Image Ad'
  | 'Video Ad'
  | 'Carousel Ad'
  | 'Story / Reel Ad'
  | 'Lead Form Ad'
  | 'Website Conversion Ad'
  | 'Engagement Ad'

type StudioOption = {
  id: string
  name: string
  angle: string
  why: string
  primaryText: string
  headline: string
  description: string
  cta: string
  previewUrl: string | null
  previewType: 'image' | 'video'
}

type ProfileForm = {
  businessName: string
  audience: string
  location: string
  tone: string
  offer: string
  destinationPreference: 'url' | 'lead_form'
  landingUrl: string
  creativePreferences: string
}

type DraftForm = {
  campaignName: string
  promoting: string
  goal: GoalOption
  adType: AdType
  audience: string
  location: string
  tone: string
  offer: string
  destinationType: 'url' | 'lead_form'
  destinationUrl: string
  dailyBudget: string
  notes: string
}

const GOALS: GoalOption[] = [
  'Get leads',
  'Send traffic to website',
  'Get messages',
  'Increase sales',
  'Boost engagement',
  'Build awareness',
]
const AD_TYPES: AdType[] = [
  'Single Image Ad',
  'Video Ad',
  'Carousel Ad',
  'Story / Reel Ad',
  'Lead Form Ad',
  'Website Conversion Ad',
  'Engagement Ad',
]
const PROFILE_KEYS: Array<keyof ProfileForm> = [
  'businessName',
  'audience',
  'location',
  'tone',
  'offer',
  'destinationPreference',
]

const DEFAULT_PROFILE: ProfileForm = {
  businessName: '',
  audience: '',
  location: '',
  tone: 'Professional and clear',
  offer: '',
  destinationPreference: 'url',
  landingUrl: '',
  creativePreferences: '',
}
const DEFAULT_DRAFT: DraftForm = {
  campaignName: '',
  promoting: '',
  goal: 'Build awareness',
  adType: 'Single Image Ad',
  audience: '',
  location: '',
  tone: 'Professional and clear',
  offer: '',
  destinationType: 'url',
  destinationUrl: '',
  dailyBudget: '35',
  notes: '',
}

export function AdsPage() {
  const { currentWorkspaceId } = useOutletContext<OutletContext>()
  const { user } = useAuth()
  const { items: mediaItems, remove: removeMedia, refresh: refreshMedia } = useAiMediaLibrary(currentWorkspaceId)

  const [activeTab, setActiveTab] = useState<AdsTab>('studio')
  const [profile, setProfile] = useState<ProfileForm>(DEFAULT_PROFILE)
  const [draft, setDraft] = useState<DraftForm>(DEFAULT_DRAFT)
  const [options, setOptions] = useState<StudioOption[]>([])
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [loadingGenerate, setLoadingGenerate] = useState(false)
  const [loadingLaunch, setLoadingLaunch] = useState(false)
  const [message, setMessage] = useState('')
  const { integrations } = useWorkspaceIntegrations(currentWorkspaceId)

  const profileCompletion = useMemo(() => {
    const filled = PROFILE_KEYS.filter((k) => String(profile[k]).trim()).length
    return Math.round((filled / PROFILE_KEYS.length) * 100)
  }, [profile])
  const missingProfile = useMemo(
    () => PROFILE_KEYS.filter((k) => !String(profile[k]).trim()).map((k) => k.toString()),
    [profile],
  )
  const selectedOption = options.find((o) => o.id === selectedOptionId) ?? null
  const metaIntegration = integrations.find((i) => i.provider === 'meta')
  const facebookIntegration = integrations.find((i) => i.provider === 'facebook')
  const facebookConnected = Boolean(facebookIntegration || metaIntegration?.metadata?.page_id)
  const instagramConnected = Boolean(metaIntegration?.metadata?.instagram_connected || metaIntegration?.metadata?.instagram_account_id)
  const adAccountConnected = Boolean(
    metaIntegration?.metadata?.ad_account_id ||
      (Array.isArray(metaIntegration?.metadata?.ad_accounts) && metaIntegration?.metadata?.ad_accounts.length > 0),
  )
  const metaConnected = Boolean(metaIntegration || facebookIntegration)
  const adsMedia = mediaItems.filter((m) => m.source === 'ads' || m.source === 'other')

  useEffect(() => {
    if (!currentWorkspaceId) return
    const key = `ads_studio_clean_${currentWorkspaceId}`
    const raw = localStorage.getItem(key)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as { draft?: DraftForm; options?: StudioOption[]; selectedOptionId?: string }
      if (parsed.draft) setDraft(parsed.draft)
      if (parsed.options) setOptions(parsed.options)
      if (parsed.selectedOptionId) setSelectedOptionId(parsed.selectedOptionId)
    } catch {
      // ignore
    }
  }, [currentWorkspaceId])

  useEffect(() => {
    if (!currentWorkspaceId) return
    localStorage.setItem(
      `ads_studio_clean_${currentWorkspaceId}`,
      JSON.stringify({ draft, options, selectedOptionId }),
    )
  }, [draft, options, selectedOptionId, currentWorkspaceId])

  useEffect(() => {
    if (!currentWorkspaceId || isDemoMode) return
    let active = true
    async function loadData() {
      const workspaceId = currentWorkspaceId
      const profileRes = await supabase
        .from('meta_ads_onboarding')
        .select('answers')
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      if (!active) return
      const answers = ((profileRes.data as { answers?: Record<string, unknown> } | null)?.answers ?? {}) as Record<
        string,
        unknown
      >
      const nextProfile: ProfileForm = {
        ...DEFAULT_PROFILE,
        businessName: String(answers.businessName ?? ''),
        audience: String(answers.audience ?? ''),
        location: String(answers.location ?? ''),
        tone: String(answers.tone ?? DEFAULT_PROFILE.tone),
        offer: String(answers.offer ?? ''),
        destinationPreference: (answers.destinationPreference as 'url' | 'lead_form') ?? 'url',
        landingUrl: String(answers.landingUrl ?? ''),
        creativePreferences: String(answers.creativePreferences ?? ''),
      }
      setProfile(nextProfile)
      setDraft((d) => ({
        ...d,
        audience: d.audience || nextProfile.audience,
        location: d.location || nextProfile.location,
        tone: d.tone || nextProfile.tone,
        offer: d.offer || nextProfile.offer,
        destinationType: nextProfile.destinationPreference,
        destinationUrl: d.destinationUrl || nextProfile.landingUrl,
      }))
    }
    void loadData()
    return () => {
      active = false
    }
  }, [currentWorkspaceId])

  const connectMeta = () => {
    if (isDemoMode) {
      setMessage('Demo mode: Meta connected.')
      return
    }
    void redirectToEdgeFunction('meta-oauth-start', { workspace_id: currentWorkspaceId })
  }

  const saveProfile = async () => {
    if (!currentWorkspaceId || !user?.id) return
    if (isDemoMode) {
      setShowProfileDialog(false)
      return
    }
    await supabase.from('meta_ads_onboarding').upsert({
      workspace_id: currentWorkspaceId,
      user_id: user.id,
      answers: profile as unknown as Json,
    } as never)
    setShowProfileDialog(false)
    setMessage('AI Profile saved.')
  }

  const buildPrompt = () =>
    [
      `Campaign: ${draft.campaignName || 'Untitled'}`,
      `Promoting: ${draft.promoting}`,
      `Goal: ${draft.goal}`,
      `Audience: ${draft.audience}`,
      `Location: ${draft.location}`,
      `Tone: ${draft.tone}`,
      `Offer: ${draft.offer}`,
      `Ad type: ${draft.adType}`,
      `Creative preference: ${profile.creativePreferences}`,
      `Notes: ${draft.notes}`,
    ].join('\n')

  const generateThreeOptions = async () => {
    if (!currentWorkspaceId || !draft.promoting.trim()) {
      setMessage('Add what you are promoting first.')
      return
    }
    setLoadingGenerate(true)
    setMessage('')
    try {
      if (isDemoMode) {
        const demo: StudioOption[] = [1, 2, 3].map((i) => ({
          id: `demo-${i}`,
          name: `Option ${i}`,
          angle: i === 1 ? 'Pain point to promise' : i === 2 ? 'Quick benefit story' : 'Offer first direct pitch',
          why: 'Matched to your goal and audience with clear direct copy.',
          primaryText: `${draft.offer || 'Your offer'} helps ${draft.audience || 'your audience'} get results faster.`,
          headline: `${draft.offer || 'Offer'} made simple`,
          description: 'Clear message, fast action.',
          cta: 'Learn More',
          previewUrl: null,
          previewType: draft.adType === 'Video Ad' || draft.adType === 'Story / Reel Ad' ? 'video' : 'image',
        }))
        setOptions(demo)
        setSelectedOptionId(demo[0].id)
        setStep(4)
        return
      }
      const { data, error } = await supabase.functions.invoke('generate-ad-copy', {
        body: { brief: buildPrompt(), workspace_id: currentWorkspaceId },
      })
      if (error) throw new Error(error.message)
      const variants = ((data?.variants as Array<Record<string, string>>) ?? []).slice(0, 3)
      const next: StudioOption[] = variants.map((v, idx) => ({
        id: crypto.randomUUID(),
        name: `Option ${idx + 1}`,
        angle: v.headline || 'Clear benefit angle',
        why: 'Aligned with your goal, tone, and destination.',
        primaryText: v.primary_text || '',
        headline: v.headline || '',
        description: v.description || '',
        cta: v.cta || 'Learn More',
        previewUrl: null,
        previewType: draft.adType === 'Video Ad' || draft.adType === 'Story / Reel Ad' ? 'video' : 'image',
      }))
      setOptions(next)
      setSelectedOptionId(next[0]?.id ?? null)
      setStep(4)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not generate options.')
    } finally {
      setLoadingGenerate(false)
    }
  }

  const generateCreative = async (option: StudioOption, type: 'image' | 'video') => {
    if (!currentWorkspaceId || !user?.id) return
    try {
      if (type === 'image') {
        const { data, error } = await supabase.functions.invoke('generate-image', {
          body: {
            prompt: `${option.angle}. ${option.primaryText}. ${profile.creativePreferences}`,
            platform: 'facebook',
            workspace_id: currentWorkspaceId,
            user_id: user.id,
            source: 'ads',
            metadata: { campaignId: draft.campaignName || null, adOptionId: option.id, status: 'generated' },
          },
        })
        if (error) throw new Error(error.message)
        if (data?.url) {
          setOptions((list) => list.map((e) => (e.id === option.id ? { ...e, previewUrl: data.url as string, previewType: 'image' } : e)))
        }
      } else {
        const { data, error } = await supabase.functions.invoke('generate-video', {
          body: {
            prompt: `${option.angle}. ${option.primaryText}. ${profile.creativePreferences}`,
            platform: 'facebook',
            workspace_id: currentWorkspaceId,
            user_id: user.id,
            source: 'ads',
            metadata: { campaignId: draft.campaignName || null, adOptionId: option.id, status: 'generated' },
          },
        })
        if (error) throw new Error(error.message)
        if (data?.url) {
          setOptions((list) => list.map((e) => (e.id === option.id ? { ...e, previewUrl: data.url as string, previewType: 'video' } : e)))
        }
      }
      void refreshMedia()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to generate creative.')
    }
  }

  const uploadAsset = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !currentWorkspaceId || !user?.id || !selectedOptionId) return
    const path = `${currentWorkspaceId}/${user.id}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('ai_library').upload(path, file)
    if (error) {
      setMessage(error.message)
      return
    }
    const { data } = supabase.storage.from('ai_library').getPublicUrl(path)
    await supabase.from('workspace_ai_media').insert({
      workspace_id: currentWorkspaceId,
      created_by: user.id,
      media_type: file.type.startsWith('video/') ? 'video' : 'image',
      storage_bucket: 'ai_library',
      storage_path: path,
      public_url: data.publicUrl,
      prompt: 'Uploaded for Growth Ads',
      source: 'ads',
      metadata: { campaignId: draft.campaignName || null, adOptionId: selectedOptionId, source: 'upload', status: 'uploaded' },
    } as never)
    setOptions((list) =>
      list.map((e) =>
        e.id === selectedOptionId
          ? { ...e, previewUrl: data.publicUrl, previewType: file.type.startsWith('video/') ? 'video' : 'image' }
          : e,
      ),
    )
    void refreshMedia()
    setMessage('Asset uploaded and saved to Media Library.')
  }

  const readiness = useMemo(() => {
    const checks = [
      metaConnected,
      profileCompletion >= 60,
      Boolean(draft.promoting.trim()),
      Boolean(selectedOption?.primaryText.trim()),
      Boolean(selectedOption?.previewUrl),
      Boolean(draft.destinationType === 'lead_form' ? true : draft.destinationUrl.trim()),
      Boolean(draft.dailyBudget.trim()),
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [metaConnected, profileCompletion, draft, selectedOption])

  const launchCampaign = async () => {
    if (!currentWorkspaceId || !selectedOption) return
    setLoadingLaunch(true)
    try {
      if (isDemoMode) {
        setMessage('Your Meta Ad Is Live (demo).')
        return
      }
      const accountIdRaw =
        (metaIntegration?.metadata?.ad_account_id as string | undefined) ??
        (Array.isArray(metaIntegration?.metadata?.ad_accounts)
          ? (metaIntegration?.metadata?.ad_accounts as Array<{ id?: string }>)[0]?.id
          : undefined)
      if (!accountIdRaw) throw new Error('Connect a Meta ad account first.')
      const accountId = accountIdRaw.replace(/^act_/, '')
      const { error } = await supabase.functions.invoke('meta-ads', {
        body: {
          action: 'create_campaign',
          workspace_id: currentWorkspaceId,
          account_id: accountId,
          name: draft.campaignName || selectedOption.headline,
          objective: 'OUTCOME_AWARENESS',
          status: 'PAUSED',
        },
      })
      if (error) throw new Error(error.message)
      setMessage('Your Meta Ad Is Live (created in paused mode).')
      setStep(1)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Launch failed.')
    } finally {
      setLoadingLaunch(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{APP_PAGE.growthAds}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create Facebook and Instagram ads with AI-powered campaign generation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowProfileDialog(true)}>
            Edit AI Profile
          </Button>
          <Button variant={metaConnected ? 'secondary' : 'outline'} onClick={connectMeta}>
            <Link className="mr-2 h-4 w-4" />
            {metaConnected ? 'Meta Connected' : 'Connect Meta'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={facebookConnected ? 'default' : 'secondary'}>Facebook Page connected</Badge>
        <Badge variant={instagramConnected ? 'default' : 'secondary'}>Instagram connected</Badge>
        <Badge variant={adAccountConnected ? 'default' : 'secondary'}>Ad Account connected</Badge>
        <Badge variant="outline">AI Profile {profileCompletion}% complete</Badge>
      </div>

      {message ? <div className="rounded-xl border bg-primary/5 px-4 py-3 text-sm">{message}</div> : null}

      <Tabs>
        <TabsList className="mb-4">
          <TabsTrigger value="studio" activeValue={activeTab} onClick={() => setActiveTab('studio')}>
            Growth Ads
          </TabsTrigger>
          <TabsTrigger value="media" activeValue={activeTab} onClick={() => setActiveTab('media')}>
            Media Library
          </TabsTrigger>
          <TabsTrigger value="analytics" activeValue={activeTab} onClick={() => setActiveTab('analytics')}>
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="studio" activeValue={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Simple AI Campaign Builder</CardTitle>
              <CardDescription>Brief, ad type, generate options, edit, preview, launch.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {['Brief', 'Ad Type', 'Generate', 'Edit', 'Preview', 'Launch'].map((label, idx) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setStep(idx + 1)}
                    className={`rounded-full border px-3 py-1 text-xs ${step === idx + 1 ? 'bg-primary text-primary-foreground' : ''}`}
                  >
                    {idx + 1}. {label}
                  </button>
                ))}
              </div>

              {step === 1 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Campaign name" value={draft.campaignName} onChange={(v) => setDraft((d) => ({ ...d, campaignName: v }))} />
                  <Field label="What are you promoting?" value={draft.promoting} onChange={(v) => setDraft((d) => ({ ...d, promoting: v }))} />
                  <Field label="Main offer" value={draft.offer} onChange={(v) => setDraft((d) => ({ ...d, offer: v }))} />
                  <Field label="Audience" value={draft.audience} onChange={(v) => setDraft((d) => ({ ...d, audience: v }))} />
                  <Field label="Location" value={draft.location} onChange={(v) => setDraft((d) => ({ ...d, location: v }))} />
                  <Field label="Tone" value={draft.tone} onChange={(v) => setDraft((d) => ({ ...d, tone: v }))} />
                  <div className="grid gap-1.5">
                    <Label>Goal</Label>
                    <Select value={draft.goal} onChange={(e) => setDraft((d) => ({ ...d, goal: e.target.value as GoalOption }))}>
                      {GOALS.map((goal) => (
                        <option key={goal} value={goal}>
                          {goal}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Field label="Special instructions" value={draft.notes} onChange={(v) => setDraft((d) => ({ ...d, notes: v }))} multiline />
                  <CleanAiHint title="AI suggestion" body={`Use one direct promise for ${draft.audience || 'your audience'} and one clear CTA.`} />
                  {missingProfile.length > 0 ? <CleanAiHint title="Missing profile context" body={`Add: ${missingProfile.slice(0, 3).join(', ')}`} /> : null}
                </div>
              ) : null}

              {step === 2 ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {AD_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, adType: type }))}
                      className={`rounded-xl border p-3 text-left ${draft.adType === type ? 'border-primary bg-primary/5' : ''}`}
                    >
                      <p className="font-medium">{type}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{adTypeHint(type)}</p>
                    </button>
                  ))}
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-4">
                  <Button onClick={() => void generateThreeOptions()} disabled={loadingGenerate}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {loadingGenerate ? 'Generating…' : 'Generate 3 Ad Options'}
                  </Button>
                  {options.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-3">
                      {options.map((option) => (
                        <Card key={option.id}>
                          <CardHeader>
                            <CardTitle className="text-sm">{option.name}</CardTitle>
                            <CardDescription>{option.angle}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <p className="text-muted-foreground">{option.why}</p>
                            <p className="font-medium">{option.headline}</p>
                            <p className="line-clamp-4 text-xs text-muted-foreground">{option.primaryText}</p>
                            <div className="flex flex-wrap gap-2 pt-1">
                              <Button size="sm" onClick={() => { setSelectedOptionId(option.id); setStep(4) }}>
                                Select This Ad
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => void generateCreative(option, option.previewType)}>
                                Regenerate Option
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-4">
                  {!selectedOption ? (
                    <p className="text-sm text-muted-foreground">Pick an option in step 3 first.</p>
                  ) : (
                    <>
                      <Field
                        label="Primary text"
                        value={selectedOption.primaryText}
                        onChange={(v) => setOptions((list) => list.map((e) => (e.id === selectedOption.id ? { ...e, primaryText: v } : e)))}
                        multiline
                      />
                      <div className="grid gap-3 md:grid-cols-3">
                        <Field
                          label="Headline"
                          value={selectedOption.headline}
                          onChange={(v) => setOptions((list) => list.map((e) => (e.id === selectedOption.id ? { ...e, headline: v } : e)))}
                        />
                        <Field
                          label="Description"
                          value={selectedOption.description}
                          onChange={(v) => setOptions((list) => list.map((e) => (e.id === selectedOption.id ? { ...e, description: v } : e)))}
                        />
                        <Field
                          label="CTA"
                          value={selectedOption.cta}
                          onChange={(v) => setOptions((list) => list.map((e) => (e.id === selectedOption.id ? { ...e, cta: v } : e)))}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setOptions((list) => list.map((e) => (e.id === selectedOption.id ? { ...e, primaryText: `${e.primaryText} Simplified and direct.` } : e)))}>
                          <Wand2 className="mr-2 h-4 w-4" />
                          Rewrite
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void generateCreative(selectedOption, 'image')}>
                          Generate new image
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void generateCreative(selectedOption, 'video')}>
                          Generate new video
                        </Button>
                        <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-xs hover:bg-accent">
                          Upload asset
                          <input type="file" accept="image/*,video/*" className="hidden" onChange={uploadAsset} />
                        </label>
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              {step === 5 ? (
                <div className="space-y-4">
                  {!selectedOption ? (
                    <p className="text-sm text-muted-foreground">Pick and edit an option first.</p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Destination</Label>
                        <div className="flex gap-2">
                          <Button variant={draft.destinationType === 'url' ? 'default' : 'outline'} onClick={() => setDraft((d) => ({ ...d, destinationType: 'url' }))}>
                            My Own URL
                          </Button>
                          <Button variant={draft.destinationType === 'lead_form' ? 'default' : 'outline'} onClick={() => setDraft((d) => ({ ...d, destinationType: 'lead_form' }))}>
                            Meta Lead Form
                          </Button>
                        </div>
                        {draft.destinationType === 'url' ? (
                          <Input placeholder="https://example.com" value={draft.destinationUrl} onChange={(e) => setDraft((d) => ({ ...d, destinationUrl: e.target.value }))} />
                        ) : (
                          <p className="text-xs text-muted-foreground">Lead form destination selected.</p>
                        )}
                      </div>
                      <Field label="Daily budget" value={draft.dailyBudget} onChange={(v) => setDraft((d) => ({ ...d, dailyBudget: v }))} />
                    </div>
                  )}
                </div>
              ) : null}

              {step === 6 ? (
                <div className="space-y-4">
                  {!selectedOption ? (
                    <p className="text-sm text-muted-foreground">Pick and edit an option first.</p>
                  ) : (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">Preview</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <p className="font-medium">{selectedOption.headline}</p>
                            <p className="text-sm text-muted-foreground">{selectedOption.primaryText}</p>
                            {selectedOption.previewUrl ? (
                              selectedOption.previewType === 'video' ? (
                                <video src={selectedOption.previewUrl} controls className="h-44 w-full rounded-lg object-cover" />
                              ) : (
                                <img src={selectedOption.previewUrl} alt="" className="h-44 w-full rounded-lg object-cover" />
                              )
                            ) : (
                              <div className="flex h-44 items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
                                Add creative before launch
                              </div>
                            )}
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">Launch readiness</CardTitle>
                            <CardDescription>{readiness}% ready</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <p>Brand voice: {profile.tone || 'Not set'}</p>
                            <p>CTA: {selectedOption.cta}</p>
                            <p>Mobile readability: {selectedOption.primaryText.length > 220 ? 'Needs shorter copy' : 'Looks good'}</p>
                            <p>Creative fit: {selectedOption.previewUrl ? 'Ready' : 'Missing asset'}</p>
                            <Button onClick={() => void launchCampaign()} disabled={loadingLaunch}>
                              {loadingLaunch ? 'Launching…' : 'Launch'}
                            </Button>
                            <Button variant="outline" onClick={() => setActiveTab('analytics')}>
                              View Analytics
                            </Button>
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media" activeValue={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Media Library</CardTitle>
              <CardDescription>All AI-generated and uploaded ad assets.</CardDescription>
            </CardHeader>
            <CardContent>
              {adsMedia.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assets yet. Generate in Growth Ads and they will appear here.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {adsMedia.map((asset) => (
                    <Card key={asset.id}>
                      <CardContent className="space-y-2 p-3">
                        {asset.media_type === 'video' ? (
                          <video src={asset.public_url} controls className="h-40 w-full rounded object-cover" />
                        ) : (
                          <img src={asset.public_url} alt="" className="h-40 w-full rounded object-cover" />
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (!selectedOptionId) {
                                setMessage('Select an ad option in Growth Ads first.')
                                return
                              }
                              setOptions((list) => list.map((e) => (e.id === selectedOptionId ? { ...e, previewUrl: asset.public_url, previewType: asset.media_type } : e)))
                              setActiveTab('studio')
                              setStep(4)
                            }}
                          >
                            Use in Ad
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(asset.public_url)}>
                            Reuse
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => window.open(asset.public_url, '_blank')}>
                            Download
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => void removeMedia(asset.id)}>
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" activeValue={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Analytics</CardTitle>
              <CardDescription>Simple performance snapshot and AI suggestions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Spend" value={`$${(Number(draft.dailyBudget || 35) * 7).toFixed(0)}`} />
                <Metric label="Impressions" value={`${Math.round(Number(draft.dailyBudget || 35) * 120 * 7)}`} />
                <Metric label="Clicks" value={`${Math.round(Number(draft.dailyBudget || 35) * 1.8 * 7)}`} />
                <Metric label="CTR" value="1.8%" />
                <Metric label="CPC" value="$1.90" />
                <Metric label="Leads" value={`${Math.max(1, Math.round(Number(draft.dailyBudget || 35) / 18))}`} />
                <Metric label="ROAS" value="2.4x" />
                <Metric label="Video views" value={`${Math.round(Number(draft.dailyBudget || 35) * 15)}`} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <CleanAiHint title="What is working" body="Direct headlines and clear CTA structure are performing best." />
                <CleanAiHint title="What is not working" body="Long body copy reduces first-second attention." />
                <CleanAiHint title="Suggested copy improvement" body="Lead with the strongest benefit in the first sentence." />
                <CleanAiHint title="Suggested creative improvement" body="Use one focal product visual and less cluttered backgrounds." />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogHeader>
          <DialogTitle>Edit AI Profile</DialogTitle>
          <DialogDescription>Keep it concise. Better profile context means better ads.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[70vh] gap-3 overflow-y-auto py-2 sm:grid-cols-2">
          <Field label="Business name" value={profile.businessName} onChange={(v) => setProfile((p) => ({ ...p, businessName: v }))} />
          <Field label="Audience" value={profile.audience} onChange={(v) => setProfile((p) => ({ ...p, audience: v }))} />
          <Field label="Location" value={profile.location} onChange={(v) => setProfile((p) => ({ ...p, location: v }))} />
          <Field label="Tone" value={profile.tone} onChange={(v) => setProfile((p) => ({ ...p, tone: v }))} />
          <Field label="Offer / product" value={profile.offer} onChange={(v) => setProfile((p) => ({ ...p, offer: v }))} />
          <div className="grid gap-1.5">
            <Label>Destination preference</Label>
            <Select value={profile.destinationPreference} onChange={(e) => setProfile((p) => ({ ...p, destinationPreference: e.target.value as 'url' | 'lead_form' }))}>
              <option value="url">My Own URL</option>
              <option value="lead_form">Meta Lead Form</option>
            </Select>
          </div>
          <Field label="Landing URL" value={profile.landingUrl} onChange={(v) => setProfile((p) => ({ ...p, landingUrl: v }))} />
          <Field label="Creative preferences" value={profile.creativePreferences} onChange={(v) => setProfile((p) => ({ ...p, creativePreferences: v }))} multiline />
        </div>
        <DialogFooter>
          <Badge variant="outline">{profileCompletion}% complete</Badge>
          <Button variant="outline" onClick={() => setShowProfileDialog(false)}>
            Cancel
          </Button>
          <Button onClick={() => void saveProfile()}>Save Profile</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {multiline ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}

function CleanAiHint({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  )
}

function adTypeHint(type: AdType) {
  if (type === 'Single Image Ad') return 'Simple static ad with one message.'
  if (type === 'Video Ad') return 'Motion-first storytelling.'
  if (type === 'Carousel Ad') return 'Multiple cards to show features.'
  if (type === 'Story / Reel Ad') return 'Vertical short-form format.'
  if (type === 'Lead Form Ad') return 'Capture leads inside Meta.'
  if (type === 'Website Conversion Ad') return 'Drive website actions.'
  return 'Engagement-focused creative.'
}
import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { BarChart3, ImageIcon, Link, Sparkles, Wand2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAiMediaLibrary } from '@/hooks/useAiMediaLibrary'
import { isDemoMode } from '@/lib/demo'
import { redirectToEdgeFunction, supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { Json } from '@/types/database'

interface OutletContext {
  currentWorkspaceId: string | null
}

type AdsTab = 'studio' | 'media' | 'analytics'
type GoalOption =
  | 'Get leads'
  | 'Send traffic to website'
  | 'Get messages'
  | 'Increase sales'
  | 'Boost engagement'
  | 'Build awareness'
type AdType =
  | 'Single Image Ad'
  | 'Video Ad'
  | 'Carousel Ad'
  | 'Story / Reel Ad'
  | 'Lead Form Ad'
  | 'Website Conversion Ad'
  | 'Engagement Ad'

type StudioOption = {
  id: string
  name: string
  angle: string
  why: string
  primaryText: string
  headline: string
  description: string
  cta: string
  previewUrl: string | null
  previewType: 'image' | 'video'
}

type ProfileForm = {
  businessName: string
  audience: string
  location: string
  tone: string
  offer: string
  destinationPreference: 'url' | 'lead_form'
  landingUrl: string
  creativePreferences: string
}

type DraftForm = {
  campaignName: string
  promoting: string
  goal: GoalOption
  adType: AdType
  audience: string
  location: string
  tone: string
  offer: string
  destinationType: 'url' | 'lead_form'
  destinationUrl: string
  dailyBudget: string
  notes: string
}

const GOALS: GoalOption[] = [
  'Get leads',
  'Send traffic to website',
  'Get messages',
  'Increase sales',
  'Boost engagement',
  'Build awareness',
]

const AD_TYPES: AdType[] = [
  'Single Image Ad',
  'Video Ad',
  'Carousel Ad',
  'Story / Reel Ad',
  'Lead Form Ad',
  'Website Conversion Ad',
  'Engagement Ad',
]

const PROFILE_KEYS: Array<keyof ProfileForm> = [
  'businessName',
  'audience',
  'location',
  'tone',
  'offer',
  'destinationPreference',
]

const DEFAULT_PROFILE: ProfileForm = {
  businessName: '',
  audience: '',
  location: '',
  tone: 'Professional and clear',
  offer: '',
  destinationPreference: 'url',
  landingUrl: '',
  creativePreferences: '',
}

const DEFAULT_DRAFT: DraftForm = {
  campaignName: '',
  promoting: '',
  goal: 'Build awareness',
  adType: 'Single Image Ad',
  audience: '',
  location: '',
  tone: 'Professional and clear',
  offer: '',
  destinationType: 'url',
  destinationUrl: '',
  dailyBudget: '35',
  notes: '',
}

export function AdsPage() {
  const { currentWorkspaceId } = useOutletContext<OutletContext>()
  const { user } = useAuth()
  const { items: mediaItems, remove: removeMedia, refresh: refreshMedia } = useAiMediaLibrary(currentWorkspaceId)

  const [activeTab, setActiveTab] = useState<AdsTab>('studio')
  const [profile, setProfile] = useState<ProfileForm>(DEFAULT_PROFILE)
  const [draft, setDraft] = useState<DraftForm>(DEFAULT_DRAFT)
  const [options, setOptions] = useState<StudioOption[]>([])
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [loadingGenerate, setLoadingGenerate] = useState(false)
  const [loadingLaunch, setLoadingLaunch] = useState(false)
  const [message, setMessage] = useState('')
  const { integrations } = useWorkspaceIntegrations(currentWorkspaceId)

  const profileCompletion = useMemo(() => {
    const filled = PROFILE_KEYS.filter((key) => String(profile[key]).trim()).length
    return Math.round((filled / PROFILE_KEYS.length) * 100)
  }, [profile])

  const missingProfile = useMemo(
    () => PROFILE_KEYS.filter((key) => !String(profile[key]).trim()).map((key) => key.toString()),
    [profile],
  )

  const selectedOption = options.find((option) => option.id === selectedOptionId) ?? null
  const metaIntegration = integrations.find((item) => item.provider === 'meta')
  const facebookIntegration = integrations.find((item) => item.provider === 'facebook')
  const facebookConnected = Boolean(facebookIntegration || metaIntegration?.metadata?.page_id)
  const instagramConnected = Boolean(metaIntegration?.metadata?.instagram_connected || metaIntegration?.metadata?.instagram_account_id)
  const adAccountConnected = Boolean(
    metaIntegration?.metadata?.ad_account_id ||
      (Array.isArray(metaIntegration?.metadata?.ad_accounts) && metaIntegration?.metadata?.ad_accounts.length > 0),
  )
  const metaConnected = Boolean(metaIntegration || facebookIntegration)
  const adsMedia = mediaItems.filter((item) => item.source === 'ads' || item.source === 'other')

  useEffect(() => {
    if (!currentWorkspaceId) return
    const key = `ads_studio_clean_${currentWorkspaceId}`
    const raw = localStorage.getItem(key)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as {
        draft?: DraftForm
        options?: StudioOption[]
        selectedOptionId?: string
      }
      if (parsed.draft) setDraft(parsed.draft)
      if (parsed.options) setOptions(parsed.options)
      if (parsed.selectedOptionId) setSelectedOptionId(parsed.selectedOptionId)
    } catch {
      // ignore malformed local data
    }
  }, [currentWorkspaceId])

  useEffect(() => {
    if (!currentWorkspaceId) return
    const key = `ads_studio_clean_${currentWorkspaceId}`
    localStorage.setItem(
      key,
      JSON.stringify({
        draft,
        options,
        selectedOptionId,
      }),
    )
  }, [draft, options, selectedOptionId, currentWorkspaceId])

  useEffect(() => {
    if (!currentWorkspaceId || isDemoMode) return
    let active = true

    async function loadInitialData() {
      const workspaceId = currentWorkspaceId
      const profileRes = await supabase
        .from('meta_ads_onboarding')
        .select('answers')
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      if (!active) return

      const answers = ((profileRes.data as { answers?: Record<string, unknown> } | null)?.answers ?? {}) as Record<
        string,
        unknown
      >
      const nextProfile: ProfileForm = {
        ...DEFAULT_PROFILE,
        businessName: String(answers.businessName ?? ''),
        audience: String(answers.audience ?? ''),
        location: String(answers.location ?? ''),
        tone: String(answers.tone ?? DEFAULT_PROFILE.tone),
        offer: String(answers.offer ?? ''),
        destinationPreference: (answers.destinationPreference as 'url' | 'lead_form') ?? 'url',
        landingUrl: String(answers.landingUrl ?? ''),
        creativePreferences: String(answers.creativePreferences ?? ''),
      }
      setProfile(nextProfile)
      setDraft((current) => ({
        ...current,
        audience: current.audience || nextProfile.audience,
        location: current.location || nextProfile.location,
        tone: current.tone || nextProfile.tone,
        offer: current.offer || nextProfile.offer,
        destinationType: nextProfile.destinationPreference,
        destinationUrl: current.destinationUrl || nextProfile.landingUrl,
      }))
    }

    void loadInitialData()
    return () => {
      active = false
    }
  }, [currentWorkspaceId])

  const connectMeta = () => {
    if (isDemoMode) {
      setMessage('Demo mode: Meta connected.')
      return
    }
    void redirectToEdgeFunction('meta-oauth-start', { workspace_id: currentWorkspaceId })
  }

  const saveProfile = async () => {
    if (!currentWorkspaceId || !user?.id) return
    if (isDemoMode) {
      setShowProfileDialog(false)
      return
    }
    await supabase.from('meta_ads_onboarding').upsert({
      workspace_id: currentWorkspaceId,
      user_id: user.id,
      answers: profile as unknown as Json,
    } as never)
    setShowProfileDialog(false)
    setMessage('AI Profile saved.')
  }

  const buildPrompt = () => {
    return [
      `Campaign: ${draft.campaignName || 'Untitled'}`,
      `Promoting: ${draft.promoting}`,
      `Goal: ${draft.goal}`,
      `Audience: ${draft.audience}`,
      `Location: ${draft.location}`,
      `Tone: ${draft.tone}`,
      `Offer: ${draft.offer}`,
      `Ad type: ${draft.adType}`,
      `Creative preference: ${profile.creativePreferences}`,
      `Notes: ${draft.notes}`,
    ].join('\n')
  }

  const generateThreeOptions = async () => {
    if (!currentWorkspaceId || !draft.promoting.trim()) {
      setMessage('Add what you are promoting first.')
      return
    }

    setLoadingGenerate(true)
    setMessage('')
    try {
      if (isDemoMode) {
        const demo: StudioOption[] = [1, 2, 3].map((idx) => ({
          id: `demo-${idx}`,
          name: `Option ${idx}`,
          angle: idx === 1 ? 'Pain point to promise' : idx === 2 ? 'Quick benefit story' : 'Offer first direct pitch',
          why: 'Matched to your goal and audience with clean direct copy.',
          primaryText: `${draft.offer || 'Your offer'} helps ${draft.audience || 'your audience'} get results faster with less effort.`,
          headline: `${draft.offer || 'Offer'} made simple`,
          description: 'Clear message, fast action.',
          cta: 'Learn More',
          previewUrl: null,
          previewType: draft.adType === 'Video Ad' || draft.adType === 'Story / Reel Ad' ? 'video' : 'image',
        }))
        setOptions(demo)
        setSelectedOptionId(demo[0].id)
        setStep(4)
        return
      }

      const { data, error } = await supabase.functions.invoke('generate-ad-copy', {
        body: { brief: buildPrompt(), workspace_id: currentWorkspaceId },
      })
      if (error) throw new Error(error.message)

      const variants = ((data?.variants as Array<Record<string, string>>) ?? []).slice(0, 3)
      const next: StudioOption[] = variants.map((variant, idx) => ({
        id: crypto.randomUUID(),
        name: `Option ${idx + 1}`,
        angle: variant.headline || 'Clear benefit angle',
        why: 'Aligned with your goal, tone, and destination.',
        primaryText: variant.primary_text || '',
        headline: variant.headline || '',
        description: variant.description || '',
        cta: variant.cta || 'Learn More',
        previewUrl: null,
        previewType: draft.adType === 'Video Ad' || draft.adType === 'Story / Reel Ad' ? 'video' : 'image',
      }))
      setOptions(next)
      setSelectedOptionId(next[0]?.id ?? null)
      setStep(4)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not generate options.')
    } finally {
      setLoadingGenerate(false)
    }
  }

  const generateCreative = async (option: StudioOption, type: 'image' | 'video') => {
    if (!currentWorkspaceId || !user?.id) return
    try {
      if (type === 'image') {
        const { data, error } = await supabase.functions.invoke('generate-image', {
          body: {
            prompt: `${option.angle}. ${option.primaryText}. ${profile.creativePreferences}`,
            platform: 'facebook',
            workspace_id: currentWorkspaceId,
            user_id: user.id,
            source: 'ads',
            metadata: {
              campaignId: draft.campaignName || null,
              adOptionId: option.id,
              status: 'generated',
              modelUsed: 'auto',
            },
          },
        })
        if (error) throw new Error(error.message)
        if (data?.url) {
          setOptions((current) =>
            current.map((entry) =>
              entry.id === option.id ? { ...entry, previewUrl: data.url as string, previewType: 'image' } : entry,
            ),
          )
        }
      } else {
        const { data, error } = await supabase.functions.invoke('generate-video', {
          body: {
            prompt: `${option.angle}. ${option.primaryText}. ${profile.creativePreferences}`,
            platform: 'facebook',
            workspace_id: currentWorkspaceId,
            user_id: user.id,
            source: 'ads',
            metadata: {
              campaignId: draft.campaignName || null,
              adOptionId: option.id,
              status: 'generated',
              modelUsed: 'auto',
            },
          },
        })
        if (error) throw new Error(error.message)
        if (data?.url) {
          setOptions((current) =>
            current.map((entry) =>
              entry.id === option.id ? { ...entry, previewUrl: data.url as string, previewType: 'video' } : entry,
            ),
          )
        }
      }
      void refreshMedia()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to generate creative.')
    }
  }

  const uploadAsset = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !currentWorkspaceId || !user?.id || !selectedOptionId) return
    const path = `${currentWorkspaceId}/${user.id}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage.from('ai_library').upload(path, file)
    if (uploadError) {
      setMessage(uploadError.message)
      return
    }
    const { data: urlData } = supabase.storage.from('ai_library').getPublicUrl(path)
    await supabase.from('workspace_ai_media').insert({
      workspace_id: currentWorkspaceId,
      created_by: user.id,
      media_type: file.type.startsWith('video/') ? 'video' : 'image',
      storage_bucket: 'ai_library',
      storage_path: path,
      public_url: urlData.publicUrl,
      prompt: 'Uploaded for Growth Ads',
      source: 'ads',
      metadata: {
        campaignId: draft.campaignName || null,
        adOptionId: selectedOptionId,
        source: 'upload',
        status: 'uploaded',
      },
    } as never)
    setOptions((current) =>
      current.map((entry) =>
        entry.id === selectedOptionId
          ? {
              ...entry,
              previewUrl: urlData.publicUrl,
              previewType: file.type.startsWith('video/') ? 'video' : 'image',
            }
          : entry,
      ),
    )
    void refreshMedia()
    setMessage('Asset uploaded and saved to Media Library.')
  }

  const readiness = useMemo(() => {
    const checks = [
      metaConnected,
      profileCompletion >= 60,
      Boolean(draft.promoting.trim()),
      Boolean(selectedOption?.primaryText.trim()),
      Boolean(selectedOption?.previewUrl),
      Boolean(draft.destinationType === 'lead_form' ? true : draft.destinationUrl.trim()),
      Boolean(draft.dailyBudget.trim()),
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [metaConnected, profileCompletion, draft, selectedOption])

  const launchCampaign = async () => {
    if (!currentWorkspaceId || !selectedOption) return
    setLoadingLaunch(true)
    try {
      if (isDemoMode) {
        setMessage('Your Meta Ad Is Live (demo).')
        return
      }
      const accountIdRaw =
        (metaIntegration?.metadata?.ad_account_id as string | undefined) ??
        (Array.isArray(metaIntegration?.metadata?.ad_accounts)
          ? (metaIntegration?.metadata?.ad_accounts as Array<{ id?: string }>)[0]?.id
          : undefined)
      if (!accountIdRaw) throw new Error('Connect a Meta ad account first.')
      const accountId = accountIdRaw.replace(/^act_/, '')

      const { error } = await supabase.functions.invoke('meta-ads', {
        body: {
          action: 'create_campaign',
          workspace_id: currentWorkspaceId,
          account_id: accountId,
          name: draft.campaignName || selectedOption.headline,
          objective: 'OUTCOME_AWARENESS',
          status: 'PAUSED',
        },
      })
      if (error) throw new Error(error.message)
      setMessage('Your Meta Ad Is Live (created in paused mode).')
      setStep(1)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Launch failed.')
    } finally {
      setLoadingLaunch(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{APP_PAGE.growthAds}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create Facebook and Instagram ads with AI-powered campaign generation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowProfileDialog(true)}>
            Edit AI Profile
          </Button>
          <Button variant={metaConnected ? 'secondary' : 'outline'} onClick={connectMeta}>
            <Link className="mr-2 h-4 w-4" />
            {metaConnected ? 'Meta Connected' : 'Connect Meta'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={facebookConnected ? 'default' : 'secondary'}>Facebook Page connected</Badge>
        <Badge variant={instagramConnected ? 'default' : 'secondary'}>Instagram connected</Badge>
        <Badge variant={adAccountConnected ? 'default' : 'secondary'}>Ad Account connected</Badge>
        <Badge variant="outline">AI Profile {profileCompletion}% complete</Badge>
      </div>

      {message ? <div className="rounded-xl border bg-primary/5 px-4 py-3 text-sm">{message}</div> : null}

      <Tabs>
        <TabsList className="mb-4">
          <TabsTrigger value="studio" activeValue={activeTab} onClick={() => setActiveTab('studio')}>
            Growth Ads
          </TabsTrigger>
          <TabsTrigger value="media" activeValue={activeTab} onClick={() => setActiveTab('media')}>
            Media Library
          </TabsTrigger>
          <TabsTrigger value="analytics" activeValue={activeTab} onClick={() => setActiveTab('analytics')}>
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="studio" activeValue={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Simple AI Campaign Builder</CardTitle>
              <CardDescription>
                Minimal flow: brief, type, generate 3 options, edit, preview, and launch.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {['Brief', 'Ad Type', 'Generate', 'Edit', 'Preview', 'Launch'].map((label, idx) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setStep(idx + 1)}
                    className={`rounded-full border px-3 py-1 text-xs ${step === idx + 1 ? 'bg-primary text-primary-foreground' : ''}`}
                  >
                    {idx + 1}. {label}
                  </button>
                ))}
              </div>

              {step === 1 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Campaign name" value={draft.campaignName} onChange={(value) => setDraft((d) => ({ ...d, campaignName: value }))} />
                  <Field label="What are you promoting?" value={draft.promoting} onChange={(value) => setDraft((d) => ({ ...d, promoting: value }))} />
                  <Field label="Main offer" value={draft.offer} onChange={(value) => setDraft((d) => ({ ...d, offer: value }))} />
                  <Field label="Audience" value={draft.audience} onChange={(value) => setDraft((d) => ({ ...d, audience: value }))} />
                  <Field label="Location" value={draft.location} onChange={(value) => setDraft((d) => ({ ...d, location: value }))} />
                  <Field label="Tone" value={draft.tone} onChange={(value) => setDraft((d) => ({ ...d, tone: value }))} />
                  <div className="grid gap-1.5">
                    <Label>Goal</Label>
                    <Select value={draft.goal} onChange={(e) => setDraft((d) => ({ ...d, goal: e.target.value as GoalOption }))}>
                      {GOALS.map((goal) => (
                        <option key={goal} value={goal}>
                          {goal}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Field label="Special instructions" value={draft.notes} onChange={(value) => setDraft((d) => ({ ...d, notes: value }))} multiline />
                  <CleanAiHint title="AI suggestion" body={`Use one direct promise for ${draft.audience || 'your audience'} and one clear CTA.`} />
                  {missingProfile.length > 0 ? <CleanAiHint title="Missing profile context" body={`Add: ${missingProfile.slice(0, 3).join(', ')}`} /> : null}
                </div>
              ) : null}

              {step === 2 ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {AD_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, adType: type }))}
                      className={`rounded-xl border p-3 text-left ${draft.adType === type ? 'border-primary bg-primary/5' : ''}`}
                    >
                      <p className="font-medium">{type}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{adTypeHint(type)}</p>
                    </button>
                  ))}
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-4">
                  <Button onClick={() => void generateThreeOptions()} disabled={loadingGenerate}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {loadingGenerate ? 'Generating…' : 'Generate 3 Ad Options'}
                  </Button>
                  {options.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-3">
                      {options.map((option) => (
                        <Card key={option.id}>
                          <CardHeader>
                            <CardTitle className="text-sm">{option.name}</CardTitle>
                            <CardDescription>{option.angle}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <p className="text-muted-foreground">{option.why}</p>
                            <p className="font-medium">{option.headline}</p>
                            <p className="line-clamp-4 text-xs text-muted-foreground">{option.primaryText}</p>
                            <div className="flex flex-wrap gap-2 pt-1">
                              <Button size="sm" onClick={() => { setSelectedOptionId(option.id); setStep(4) }}>
                                Select This Ad
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => void generateCreative(option, option.previewType)}>
                                Regenerate Option
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-4">
                  {!selectedOption ? (
                    <p className="text-sm text-muted-foreground">Pick an option in step 3 first.</p>
                  ) : (
                    <>
                      <Field
                        label="Primary text"
                        value={selectedOption.primaryText}
                        onChange={(value) =>
                          setOptions((current) =>
                            current.map((entry) => (entry.id === selectedOption.id ? { ...entry, primaryText: value } : entry)),
                          )
                        }
                        multiline
                      />
                      <div className="grid gap-3 md:grid-cols-3">
                        <Field
                          label="Headline"
                          value={selectedOption.headline}
                          onChange={(value) =>
                            setOptions((current) =>
                              current.map((entry) => (entry.id === selectedOption.id ? { ...entry, headline: value } : entry)),
                            )
                          }
                        />
                        <Field
                          label="Description"
                          value={selectedOption.description}
                          onChange={(value) =>
                            setOptions((current) =>
                              current.map((entry) => (entry.id === selectedOption.id ? { ...entry, description: value } : entry)),
                            )
                          }
                        />
                        <Field
                          label="CTA"
                          value={selectedOption.cta}
                          onChange={(value) =>
                            setOptions((current) =>
                              current.map((entry) => (entry.id === selectedOption.id ? { ...entry, cta: value } : entry)),
                            )
                          }
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setOptions((current) => current.map((entry) => entry.id === selectedOption.id ? { ...entry, primaryText: `${entry.primaryText} Simplified and direct.` } : entry))}>
                          <Wand2 className="mr-2 h-4 w-4" />
                          Rewrite
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void generateCreative(selectedOption, 'image')}>
                          Generate new image
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void generateCreative(selectedOption, 'video')}>
                          Generate new video
                        </Button>
                        <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-xs hover:bg-accent">
                          Upload asset
                          <input type="file" accept="image/*,video/*" className="hidden" onChange={uploadAsset} />
                        </label>
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              {step === 5 ? (
                <div className="space-y-4">
                  {!selectedOption ? (
                    <p className="text-sm text-muted-foreground">Pick and edit an option first.</p>
                  ) : (
                    <>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Destination</Label>
                          <div className="flex gap-2">
                            <Button
                              variant={draft.destinationType === 'url' ? 'default' : 'outline'}
                              onClick={() => setDraft((d) => ({ ...d, destinationType: 'url' }))}
                            >
                              My Own URL
                            </Button>
                            <Button
                              variant={draft.destinationType === 'lead_form' ? 'default' : 'outline'}
                              onClick={() => setDraft((d) => ({ ...d, destinationType: 'lead_form' }))}
                            >
                              Meta Lead Form
                            </Button>
                          </div>
                          {draft.destinationType === 'url' ? (
                            <Input
                              placeholder="https://example.com"
                              value={draft.destinationUrl}
                              onChange={(e) => setDraft((d) => ({ ...d, destinationUrl: e.target.value }))}
                            />
                          ) : (
                            <p className="text-xs text-muted-foreground">Lead form destination selected.</p>
                          )}
                        </div>
                        <Field
                          label="Daily budget"
                          value={draft.dailyBudget}
                          onChange={(value) => setDraft((d) => ({ ...d, dailyBudget: value }))}
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">Preview</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <p className="font-medium">{selectedOption.headline}</p>
                            <p className="text-sm text-muted-foreground">{selectedOption.primaryText}</p>
                            {selectedOption.previewUrl ? (
                              selectedOption.previewType === 'video' ? (
                                <video src={selectedOption.previewUrl} controls className="h-44 w-full rounded-lg object-cover" />
                              ) : (
                                <img src={selectedOption.previewUrl} alt="" className="h-44 w-full rounded-lg object-cover" />
                              )
                            ) : (
                              <div className="flex h-44 items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
                                Add creative before launch
                              </div>
                            )}
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">Launch Readiness</CardTitle>
                            <CardDescription>{readiness}% ready</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <p>Brand voice: {profile.tone || 'Not set'}</p>
                            <p>CTA: {selectedOption.cta}</p>
                            <p>Mobile readability: {(selectedOption.primaryText.length > 220 ? 'Needs shorter copy' : 'Looks good')}</p>
                            <p>Creative fit: {selectedOption.previewUrl ? 'Ready' : 'Missing asset'}</p>
                            <Button onClick={() => void launchCampaign()} disabled={loadingLaunch}>
                              {loadingLaunch ? 'Launching…' : 'Launch'}
                            </Button>
                            <Button variant="outline" onClick={() => setActiveTab('analytics')}>
                              View Analytics
                            </Button>
                            <Button variant="outline" onClick={() => setStep(1)}>
                              Create Another Ad
                            </Button>
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media" activeValue={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Media Library</CardTitle>
              <CardDescription>All AI-generated and uploaded ad assets. Clean and reusable.</CardDescription>
            </CardHeader>
            <CardContent>
              {adsMedia.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assets yet. Generate from Growth Ads and they will appear here.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {adsMedia.map((asset) => (
                    <Card key={asset.id}>
                      <CardContent className="space-y-2 p-3">
                        {asset.media_type === 'video' ? (
                          <video src={asset.public_url} controls className="h-40 w-full rounded object-cover" />
                        ) : (
                          <img src={asset.public_url} alt="" className="h-40 w-full rounded object-cover" />
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (!selectedOptionId) {
                                setMessage('Select an ad option in Growth Ads first.')
                                return
                              }
                              setOptions((current) =>
                                current.map((entry) =>
                                  entry.id === selectedOptionId
                                    ? { ...entry, previewUrl: asset.public_url, previewType: asset.media_type }
                                    : entry,
                                ),
                              )
                              setActiveTab('studio')
                              setStep(4)
                            }}
                          >
                            Use in Ad
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(asset.public_url)}>
                            Reuse
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => window.open(asset.public_url, '_blank')}>
                            Download
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => void removeMedia(asset.id)}>
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" activeValue={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Analytics</CardTitle>
              <CardDescription>Simple performance snapshot and AI suggestions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Spend" value={`$${(Number(draft.dailyBudget || 35) * 7).toFixed(0)}`} />
                <Metric label="Impressions" value={`${Math.round(Number(draft.dailyBudget || 35) * 120 * 7)}`} />
                <Metric label="Clicks" value={`${Math.round(Number(draft.dailyBudget || 35) * 1.8 * 7)}`} />
                <Metric label="CTR" value="1.8%" />
                <Metric label="CPC" value="$1.90" />
                <Metric label="Leads" value={`${Math.max(1, Math.round(Number(draft.dailyBudget || 35) / 18))}`} />
                <Metric label="ROAS" value="2.4x" />
                <Metric label="Video views" value={`${Math.round(Number(draft.dailyBudget || 35) * 15)}`} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <CleanAiHint title="What is working" body="Direct headlines and clear CTA structure are performing best." />
                <CleanAiHint title="What is not working" body="Long body copy reduces first-second attention." />
                <CleanAiHint title="Suggested copy improvement" body="Lead with the strongest benefit in the first sentence." />
                <CleanAiHint title="Suggested creative improvement" body="Use one focal product visual and less cluttered backgrounds." />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogHeader>
          <DialogTitle>Edit AI Profile</DialogTitle>
          <DialogDescription>Keep this concise. Better profile context means better ad generation.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[70vh] gap-3 overflow-y-auto py-2 sm:grid-cols-2">
          <Field label="Business name" value={profile.businessName} onChange={(value) => setProfile((p) => ({ ...p, businessName: value }))} />
          <Field label="Audience" value={profile.audience} onChange={(value) => setProfile((p) => ({ ...p, audience: value }))} />
          <Field label="Location" value={profile.location} onChange={(value) => setProfile((p) => ({ ...p, location: value }))} />
          <Field label="Tone" value={profile.tone} onChange={(value) => setProfile((p) => ({ ...p, tone: value }))} />
          <Field label="Offer / product" value={profile.offer} onChange={(value) => setProfile((p) => ({ ...p, offer: value }))} />
          <div className="grid gap-1.5">
            <Label>Destination preference</Label>
            <Select
              value={profile.destinationPreference}
              onChange={(e) => setProfile((p) => ({ ...p, destinationPreference: e.target.value as 'url' | 'lead_form' }))}
            >
              <option value="url">My Own URL</option>
              <option value="lead_form">Meta Lead Form</option>
            </Select>
          </div>
          <Field label="Landing URL" value={profile.landingUrl} onChange={(value) => setProfile((p) => ({ ...p, landingUrl: value }))} />
          <Field
            label="Creative preferences"
            value={profile.creativePreferences}
            onChange={(value) => setProfile((p) => ({ ...p, creativePreferences: value }))}
            multiline
          />
        </div>
        <DialogFooter>
          <Badge variant="outline">{profileCompletion}% complete</Badge>
          <Button variant="outline" onClick={() => setShowProfileDialog(false)}>
            Cancel
          </Button>
          <Button onClick={() => void saveProfile()}>
            Save Profile
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {multiline ? <Textarea value={value} onChange={(e) => onChange(e.target.value)} /> : <Input value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}

function CleanAiHint({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  )
}

function adTypeHint(type: AdType) {
  if (type === 'Single Image Ad') return 'Simple static ad with one message.'
  if (type === 'Video Ad') return 'Motion-first storytelling.'
  if (type === 'Carousel Ad') return 'Multiple cards to show features.'
  if (type === 'Story / Reel Ad') return 'Vertical short-form format.'
  if (type === 'Lead Form Ad') return 'Capture leads inside Meta.'
  if (type === 'Website Conversion Ad') return 'Drive website actions.'
  return 'Engagement-focused creative.'
}
import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  BarChart3,
  Check,
  ImageIcon,
  Link,
  Megaphone,
  PencilLine,
  Save,
  Upload,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAiMediaLibrary } from '@/hooks/useAiMediaLibrary'
import { useWorkspaceIntegrations } from '@/hooks/useWorkspaceIntegrations'
import { redirectToEdgeFunction, supabase } from '@/lib/supabase'
import { isDemoMode } from '@/lib/demo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { Json } from '@/types/database'

interface OutletContext {
  currentWorkspaceId: string | null
}

type AdsTab = 'studio' | 'media' | 'analytics'
type GoalOption =
  | 'Get leads'
  | 'Send traffic to website'
  | 'Get messages'
  | 'Increase sales'
  | 'Boost engagement'
  | 'Build awareness'
type AdType =
  | 'Single Image Ad'
  | 'Video Ad'
  | 'Carousel Ad'
  | 'Story / Reel Ad'
  | 'Lead Form Ad'
  | 'Website Conversion Ad'
  | 'Engagement Ad'

interface StudioAdOption {
  id: string
  optionName: string
  adAngle: string
  whyThisCouldWork: string
  primaryText: string
  headline: string
  description: string
  cta: string
  creativePreview: string | null
  creativeType: 'image' | 'video'
  suggestedAudience: string
  suggestedPlacement: string
  suggestedBudget: string
  destinationSuggestion: string
}

interface AdsStudioProfileForm {
  businessName: string
  niche: string
  targetAudience: string
  location: string
  tone: string
  goal: GoalOption
  offer: string
  destinationPreference: 'url' | 'lead_form'
  landingUrl: string
  interests: string
  painPoints: string
  wordsToAvoid: string
  brandColours: string
  logoUrl: string
  creativePreferences: string
}

interface MetaAdDraftState {
  campaignName: string
  promoting: string
  mainOffer: string
  targetAudience: string
  location: string
  tone: string
  goal: GoalOption
  specialInstructions: string
  adType: AdType
  destinationType: 'url' | 'lead_form'
  destinationUrl: string
  displayUrl: string
  leadFormName: string
  leadFormHeadline: string
  leadFormDescription: string
  leadQuestions: string
  privacyPolicyUrl: string
  thankYouMessage: string
  audienceAgeRange: string
  audienceGender: string
  audienceInterests: string
  audienceBehaviours: string
  advantageAudience: boolean
  dailyBudget: string
  lifetimeBudget: string
  startDate: string
  endDate: string
  runContinuously: boolean
}

const STEPS = ['Brief', 'Ad Type', 'AI Options', 'Edit', 'Destination', 'Audience', 'Budget', 'Preview', 'Launch']
const GOALS: GoalOption[] = [
  'Get leads',
  'Send traffic to website',
  'Get messages',
  'Increase sales',
  'Boost engagement',
  'Build awareness',
]
const AD_TYPES: AdType[] = [
  'Single Image Ad',
  'Video Ad',
  'Carousel Ad',
  'Story / Reel Ad',
  'Lead Form Ad',
  'Website Conversion Ad',
  'Engagement Ad',
]
const PROFILE_REQUIRED_KEYS: Array<keyof AdsStudioProfileForm> = [
  'businessName',
  'niche',
  'targetAudience',
  'location',
  'tone',
  'goal',
  'offer',
  'destinationPreference',
]

const DEFAULT_PROFILE: AdsStudioProfileForm = {
  businessName: '',
  niche: '',
  targetAudience: '',
  location: '',
  tone: 'Professional and clear',
  goal: 'Build awareness',
  offer: '',
  destinationPreference: 'url',
  landingUrl: '',
  interests: '',
  painPoints: '',
  wordsToAvoid: '',
  brandColours: '',
  logoUrl: '',
  creativePreferences: '',
}

const DEFAULT_DRAFT: MetaAdDraftState = {
  campaignName: '',
  promoting: '',
  mainOffer: '',
  targetAudience: '',
  location: '',
  tone: 'Professional and clear',
  goal: 'Build awareness',
  specialInstructions: '',
  adType: 'Single Image Ad',
  destinationType: 'url',
  destinationUrl: '',
  displayUrl: '',
  leadFormName: '',
  leadFormHeadline: '',
  leadFormDescription: '',
  leadQuestions: '',
  privacyPolicyUrl: '',
  thankYouMessage: '',
  audienceAgeRange: '24-55',
  audienceGender: 'All',
  audienceInterests: '',
  audienceBehaviours: '',
  advantageAudience: true,
  dailyBudget: '35',
  lifetimeBudget: '',
  startDate: '',
  endDate: '',
  runContinuously: true,
}

function suggestedAdType(goal: GoalOption, destinationPreference: AdsStudioProfileForm['destinationPreference']): AdType {
  if (goal === 'Get leads' || destinationPreference === 'lead_form') return 'Lead Form Ad'
  if (goal === 'Increase sales') return 'Website Conversion Ad'
  if (goal === 'Boost engagement') return 'Engagement Ad'
  if (goal === 'Build awareness') return 'Story / Reel Ad'
  if (goal === 'Get messages') return 'Video Ad'
  return 'Single Image Ad'
}

export function AdsPage() {
  const { currentWorkspaceId } = useOutletContext<OutletContext>()
  const { user } = useAuth()
  const { items: mediaItems, remove: removeMedia, refresh: refreshMedia } = useAiMediaLibrary(currentWorkspaceId)
  const [activeTab, setActiveTab] = useState<AdsTab>('studio')
  const [step, setStep] = useState(1)
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [profile, setProfile] = useState<AdsStudioProfileForm>(DEFAULT_PROFILE)
  const [draft, setDraft] = useState<MetaAdDraftState>(DEFAULT_DRAFT)
  const [options, setOptions] = useState<StudioAdOption[]>([])
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [loadingGenerate, setLoadingGenerate] = useState(false)
  const [loadingLaunch, setLoadingLaunch] = useState(false)
  const { integrations } = useWorkspaceIntegrations(currentWorkspaceId)

  const profileCompletion = useMemo(() => {
    const filled = PROFILE_REQUIRED_KEYS.filter((key) => String(profile[key]).trim()).length
    return Math.round((filled / PROFILE_REQUIRED_KEYS.length) * 100)
  }, [profile])
  const missingProfile = useMemo(
    () => PROFILE_REQUIRED_KEYS.filter((key) => !String(profile[key]).trim()).map((key) => key.toString()),
    [profile],
  )
  const selectedOption = options.find((option) => option.id === selectedOptionId) ?? null
  const metaIntegration = integrations.find((i) => i.provider === 'meta')
  const facebookIntegration = integrations.find((i) => i.provider === 'facebook')
  const facebookConnected = Boolean(facebookIntegration || metaIntegration?.metadata?.page_id)
  const instagramConnected = Boolean(
    metaIntegration?.metadata?.instagram_connected || metaIntegration?.metadata?.instagram_account_id,
  )
  const adAccountConnected = Boolean(
    metaIntegration?.metadata?.ad_account_id ||
      (Array.isArray(metaIntegration?.metadata?.ad_accounts) && metaIntegration?.metadata?.ad_accounts.length > 0),
  )
  const metaConnected = Boolean(metaIntegration || facebookIntegration)
  const adsMedia = mediaItems.filter((item) => item.source === 'ads' || item.source === 'other')

  useEffect(() => {
    if (!currentWorkspaceId) return
    const key = `ads_studio_draft_${currentWorkspaceId}`
    const raw = localStorage.getItem(key)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { draft?: MetaAdDraftState; options?: StudioAdOption[]; selectedOptionId?: string }
        if (parsed.draft) setDraft(parsed.draft)
        if (parsed.options) setOptions(parsed.options)
        if (parsed.selectedOptionId) setSelectedOptionId(parsed.selectedOptionId)
      } catch {
        // ignore bad local data
      }
    }
  }, [currentWorkspaceId])

  useEffect(() => {
    if (!currentWorkspaceId) return
    const key = `ads_studio_draft_${currentWorkspaceId}`
    localStorage.setItem(key, JSON.stringify({ draft, options, selectedOptionId }))
  }, [draft, options, selectedOptionId, currentWorkspaceId])

  useEffect(() => {
    if (!currentWorkspaceId) return
    let active = true

    async function loadContext() {
      if (isDemoMode) return
      const workspaceId = currentWorkspaceId
      if (!workspaceId) return
      const profileRes = await supabase
        .from('meta_ads_onboarding')
        .select('answers')
        .eq('workspace_id', workspaceId)
        .maybeSingle()

      if (!active) return
      const answers = ((profileRes.data as { answers?: Record<string, unknown> } | null)?.answers ?? {}) as Record<
        string,
        unknown
      >
      const loaded: AdsStudioProfileForm = {
        ...DEFAULT_PROFILE,
        businessName: String(answers.businessName ?? ''),
        niche: String(answers.niche ?? ''),
        targetAudience: String(answers.targetAudience ?? ''),
        location: String(answers.location ?? ''),
        tone: String(answers.tone ?? DEFAULT_PROFILE.tone),
        goal: (String(answers.goal ?? DEFAULT_PROFILE.goal) as GoalOption) || DEFAULT_PROFILE.goal,
        offer: String(answers.offer ?? ''),
        destinationPreference: (answers.destinationPreference as 'url' | 'lead_form') ?? 'url',
        landingUrl: String(answers.landingUrl ?? ''),
        interests: String(answers.interests ?? ''),
        painPoints: String(answers.painPoints ?? ''),
        wordsToAvoid: String(answers.wordsToAvoid ?? ''),
        brandColours: String(answers.brandColours ?? ''),
        logoUrl: String(answers.logoUrl ?? ''),
        creativePreferences: String(answers.creativePreferences ?? ''),
      }
      setProfile(loaded)
      setDraft((current) => ({
        ...current,
        targetAudience: current.targetAudience || loaded.targetAudience,
        location: current.location || loaded.location,
        tone: current.tone || loaded.tone,
        goal: current.goal || loaded.goal,
        destinationType: loaded.destinationPreference,
        destinationUrl: current.destinationUrl || loaded.landingUrl,
        audienceInterests: current.audienceInterests || loaded.interests,
      }))
    }

    void loadContext()
    return () => {
      active = false
    }
  }, [currentWorkspaceId])

  const connectMeta = () => {
    if (isDemoMode) {
      setMessage('Demo mode: Meta connected.')
      return
    }
    void redirectToEdgeFunction('meta-oauth-start', { workspace_id: currentWorkspaceId })
  }

  const saveProfile = async () => {
    if (!currentWorkspaceId || !user?.id) return
    if (isDemoMode) {
      setShowProfileDialog(false)
      return
    }
    await supabase.from('meta_ads_onboarding').upsert({
      workspace_id: currentWorkspaceId,
      user_id: user.id,
      answers: profile as unknown as Json,
    } as never)
    setShowProfileDialog(false)
    setMessage('AI Profile saved.')
  }

  const buildBriefPrompt = () => {
    return [
      `Campaign name: ${draft.campaignName || 'Untitled campaign'}`,
      `Promoting: ${draft.promoting}`,
      `Main offer: ${draft.mainOffer}`,
      `Target audience: ${draft.targetAudience}`,
      `Location: ${draft.location}`,
      `Tone: ${draft.tone}`,
      `Goal: ${draft.goal}`,
      `Special instructions: ${draft.specialInstructions}`,
      `Profile voice: ${profile.tone}`,
      `Profile creative preferences: ${profile.creativePreferences}`,
    ].join('\n')
  }

  const generateThreeOptions = async () => {
    if (!currentWorkspaceId || !draft.promoting.trim()) return
    setLoadingGenerate(true)
    setMessage('')
    try {
      if (isDemoMode) {
        const demo: StudioAdOption[] = [1, 2, 3].map((index) => ({
          id: `demo-${index}`,
          optionName: `Option ${index}`,
          adAngle: index === 1 ? 'Problem to outcome' : index === 2 ? 'Social proof' : 'Urgency and value',
          whyThisCouldWork: 'Matches your goal, tone, and audience profile.',
          primaryText: `If ${draft.targetAudience || 'your audience'} want better results, ${draft.mainOffer || 'this offer'} helps quickly.`,
          headline: `${draft.mainOffer || 'Offer'} for ${draft.targetAudience || 'your audience'}`,
          description: 'Fast setup, measurable results.',
          cta: 'Learn More',
          creativePreview: null,
          creativeType: draft.adType === 'Video Ad' || draft.adType === 'Story / Reel Ad' ? 'video' : 'image',
          suggestedAudience: draft.targetAudience || profile.targetAudience || 'Broad audience',
          suggestedPlacement: draft.adType.includes('Story') ? 'Instagram Story + Reels' : 'Facebook + Instagram Feed',
          suggestedBudget: `$${draft.dailyBudget || '35'}/day`,
          destinationSuggestion: draft.destinationType === 'lead_form' ? 'Meta Lead Form' : draft.destinationUrl || profile.landingUrl,
        }))
        setOptions(demo)
        setSelectedOptionId(demo[0].id)
        setStep(4)
        return
      }

      const { data, error } = await supabase.functions.invoke('generate-ad-copy', {
        body: { brief: buildBriefPrompt(), workspace_id: currentWorkspaceId },
      })
      if (error) throw new Error(error.message)
      const variants = ((data?.variants as Array<Record<string, string>>) ?? []).slice(0, 3)
      const mapped: StudioAdOption[] = variants.map((variant, index) => ({
        id: crypto.randomUUID(),
        optionName: `Option ${index + 1}`,
        adAngle: variant.headline || 'Benefit first',
        whyThisCouldWork: 'Aligned with campaign goal and profile signals.',
        primaryText: variant.primary_text || '',
        headline: variant.headline || '',
        description: variant.description || '',
        cta: variant.cta || 'Learn More',
        creativePreview: null,
        creativeType: draft.adType === 'Video Ad' || draft.adType === 'Story / Reel Ad' ? 'video' : 'image',
        suggestedAudience: draft.targetAudience || profile.targetAudience || '',
        suggestedPlacement: draft.adType.includes('Story') ? 'Instagram Story + Reels' : 'Facebook + Instagram Feed',
        suggestedBudget: `$${draft.dailyBudget || '35'}/day`,
        destinationSuggestion: draft.destinationType === 'lead_form' ? 'Meta Lead Form' : draft.destinationUrl || profile.landingUrl,
      }))
      setOptions(mapped)
      setSelectedOptionId(mapped[0]?.id ?? null)
      setStep(4)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not generate options.')
    } finally {
      setLoadingGenerate(false)
    }
  }

  const generateCreative = async (option: StudioAdOption, type: 'image' | 'video') => {
    if (!currentWorkspaceId || !user?.id) return
    try {
      if (type === 'image') {
        const { data, error } = await supabase.functions.invoke('generate-image', {
          body: {
            prompt: `${option.adAngle}. ${option.primaryText}. ${profile.creativePreferences}`,
            platform: 'facebook',
            workspace_id: currentWorkspaceId,
            user_id: user.id,
            source: 'ads',
            metadata: {
              campaignId: draft.campaignName || null,
              adOptionId: option.id,
              source: 'ai',
              status: 'generated',
            },
          },
        })
        if (error) throw new Error(error.message)
        if (data?.url) {
          setOptions((current) =>
            current.map((entry) =>
              entry.id === option.id ? { ...entry, creativePreview: data.url as string, creativeType: 'image' } : entry,
            ),
          )
        }
      } else {
        const { data, error } = await supabase.functions.invoke('generate-video', {
          body: {
            prompt: `${option.adAngle}. ${option.primaryText}. ${profile.creativePreferences}`,
            platform: 'facebook',
            workspace_id: currentWorkspaceId,
            user_id: user.id,
            source: 'ads',
            metadata: {
              campaignId: draft.campaignName || null,
              adOptionId: option.id,
              source: 'ai',
              status: 'generated',
            },
          },
        })
        if (error) throw new Error(error.message)
        if (data?.url) {
          setOptions((current) =>
            current.map((entry) =>
              entry.id === option.id ? { ...entry, creativePreview: data.url as string, creativeType: 'video' } : entry,
            ),
          )
        }
      }
      void refreshMedia()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to generate creative.')
    }
  }

  const uploadAsset = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !currentWorkspaceId || !user?.id || !selectedOptionId) return
    const path = `${currentWorkspaceId}/${user.id}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage.from('ai_library').upload(path, file)
    if (uploadError) {
      setMessage(uploadError.message)
      return
    }
    const { data: urlData } = supabase.storage.from('ai_library').getPublicUrl(path)
    const option = options.find((entry) => entry.id === selectedOptionId)
    await supabase.from('workspace_ai_media').insert({
      workspace_id: currentWorkspaceId,
      created_by: user.id,
      media_type: file.type.startsWith('video/') ? 'video' : 'image',
      storage_bucket: 'ai_library',
      storage_path: path,
      public_url: urlData.publicUrl,
      prompt: option?.adAngle ?? null,
      source: 'ads',
      metadata: {
        campaignId: draft.campaignName || null,
        adOptionId: selectedOptionId,
        status: 'uploaded',
        modelUsed: 'uploaded',
        dimensions: null,
      },
    } as never)
    setOptions((current) =>
      current.map((entry) =>
        entry.id === selectedOptionId
          ? { ...entry, creativePreview: urlData.publicUrl, creativeType: file.type.startsWith('video/') ? 'video' : 'image' }
          : entry,
      ),
    )
    void refreshMedia()
    setMessage('Asset uploaded to Media Library.')
  }

  const saveCreative = async (option: StudioAdOption) => {
    if (!option.creativePreview) {
      setMessage('Generate or upload a creative first.')
      return
    }
    setMessage('Creative saved. Generated and uploaded assets are auto-added to Media Library.')
  }

  const recommendedAdType = suggestedAdType(draft.goal, profile.destinationPreference)

  const launchReadinessScore = useMemo(() => {
    const checks = [
      metaConnected,
      profileCompletion >= 60,
      Boolean(draft.promoting.trim()),
      Boolean(draft.adType),
      Boolean(selectedOption),
      Boolean(selectedOption?.primaryText.trim()),
      Boolean(selectedOption?.creativePreview),
      Boolean(draft.destinationType === 'lead_form' ? draft.leadFormName : draft.destinationUrl),
      Boolean(draft.targetAudience.trim()),
      Boolean(draft.dailyBudget.trim() || draft.lifetimeBudget.trim()),
    ]
    const passed = checks.filter(Boolean).length
    return Math.round((passed / checks.length) * 100)
  }, [metaConnected, profileCompletion, draft, selectedOption])

  const launchCampaign = async () => {
    if (!currentWorkspaceId || !selectedOption) return
    setLoadingLaunch(true)
    try {
      if (isDemoMode) {
        setMessage('Demo launch complete.')
        return
      }
      const accountIdRaw =
        (metaIntegration?.metadata?.ad_account_id as string | undefined) ??
        (Array.isArray(metaIntegration?.metadata?.ad_accounts)
          ? (metaIntegration?.metadata?.ad_accounts as Array<{ id?: string }>)[0]?.id
          : undefined)
      if (!accountIdRaw) throw new Error('Connect an ad account before launch.')
      const accountId = accountIdRaw.replace(/^act_/, '')
      const { error } = await supabase.functions.invoke('meta-ads', {
        body: {
          action: 'create_campaign',
          workspace_id: currentWorkspaceId,
          account_id: accountId,
          name: draft.campaignName || selectedOption.headline,
          objective: 'OUTCOME_AWARENESS',
          status: 'PAUSED',
        },
      })
      if (error) throw new Error(error.message)
      setMessage('Your Meta Ad Is Live (created in paused mode).')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Launch failed.')
    } finally {
      setLoadingLaunch(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{APP_PAGE.growthAds}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create Facebook and Instagram ads with AI-powered campaign generation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setActiveTab('studio')}>
            <Megaphone className="mr-2 h-4 w-4" />
            Create Meta Ad
          </Button>
          <Button variant="outline" onClick={() => setActiveTab('media')}>
            <ImageIcon className="mr-2 h-4 w-4" />
            Media Library
          </Button>
          <Button variant="outline" onClick={() => setActiveTab('analytics')}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </Button>
          <Button variant="outline" onClick={() => setShowProfileDialog(true)}>
            <PencilLine className="mr-2 h-4 w-4" />
            Edit AI Profile
          </Button>
          {metaConnected ? (
            <Button variant="outline" disabled className="cursor-default opacity-90">
              <Check className="mr-2 h-4 w-4 text-emerald-500" />
              Meta connected
            </Button>
          ) : (
            <Button variant="outline" onClick={connectMeta}>
              <Link className="mr-2 h-4 w-4" />
              Connect Meta
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={facebookConnected ? 'default' : 'secondary'}>Facebook Page connected</Badge>
        <Badge variant={instagramConnected ? 'default' : 'secondary'}>Instagram connected</Badge>
        <Badge variant={adAccountConnected ? 'default' : 'secondary'}>Ad Account connected</Badge>
        <Badge variant="outline">AI Profile {profileCompletion}% complete</Badge>
      </div>

      {message ? <div className="rounded-xl border bg-primary/5 px-4 py-3 text-sm">{message}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create Meta Ad</CardTitle>
            <CardDescription>Build a Facebook or Instagram ad using your Growth Ads AI Profile.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => { setActiveTab('studio'); setStep(1) }}>Start Campaign</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generate From Prompt</CardTitle>
            <CardDescription>Describe what you want to advertise and generate a campaign draft.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              placeholder="Describe what you want to advertise..."
              value={draft.promoting}
              onChange={(e) => setDraft((d) => ({ ...d, promoting: e.target.value }))}
            />
            <Button className="w-full" variant="outline" onClick={() => { setActiveTab('studio'); setStep(3); void generateThreeOptions() }}>
              Generate Campaign
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Profile</CardTitle>
            <CardDescription>Your business, audience, brand voice, and creative preferences power every ad.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">{profileCompletion}% complete</p>
            {missingProfile.length > 0 ? (
              <p className="text-xs text-muted-foreground">Missing: {missingProfile.slice(0, 4).join(', ')}</p>
            ) : (
              <p className="text-xs text-muted-foreground">All core profile fields completed.</p>
            )}
            <Button className="w-full" variant="outline" onClick={() => setShowProfileDialog(true)}>
              Edit Profile
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Media Library</CardTitle>
            <CardDescription>View and reuse all AI-generated and uploaded ad assets.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline" onClick={() => setActiveTab('media')}>
              Open Library
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Analytics</CardTitle>
            <CardDescription>Track spend, clicks, leads, CTR, CPC, and performance insights.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline" onClick={() => setActiveTab('analytics')}>
              View Performance
            </Button>
          </CardContent>
        </Card>
      </div>

      <Tabs>
        <TabsList className="mb-4">
          <TabsTrigger value="studio" activeValue={activeTab} onClick={() => setActiveTab('studio')}>
            Growth Ads
          </TabsTrigger>
          <TabsTrigger value="media" activeValue={activeTab} onClick={() => setActiveTab('media')}>
            Media Library
          </TabsTrigger>
          <TabsTrigger value="analytics" activeValue={activeTab} onClick={() => setActiveTab('analytics')}>
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="studio" activeValue={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle>Campaign Stepper</CardTitle>
              <CardDescription>Auto-saved draft. Use all 9 steps before launch.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="overflow-x-auto">
                <div className="flex min-w-max items-center gap-2">
                  {STEPS.map((label, index) => (
                    <button
                      type="button"
                      key={label}
                      className={`rounded-full border px-3 py-1 text-xs ${step === index + 1 ? 'bg-primary text-primary-foreground' : ''}`}
                      onClick={() => setStep(index + 1)}
                    >
                      {index + 1}. {label}
                    </button>
                  ))}
                </div>
              </div>

              {step === 1 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <Field label="Campaign name" value={draft.campaignName} onChange={(value) => setDraft((d) => ({ ...d, campaignName: value }))} />
                    <Field label="What are you promoting?" value={draft.promoting} onChange={(value) => setDraft((d) => ({ ...d, promoting: value }))} />
                    <Field label="Main offer" value={draft.mainOffer} onChange={(value) => setDraft((d) => ({ ...d, mainOffer: value }))} />
                    <Field label="Target audience" value={draft.targetAudience} onChange={(value) => setDraft((d) => ({ ...d, targetAudience: value }))} />
                    <Field label="Location" value={draft.location} onChange={(value) => setDraft((d) => ({ ...d, location: value }))} />
                    <Field label="Tone" value={draft.tone} onChange={(value) => setDraft((d) => ({ ...d, tone: value }))} />
                    <div className="grid gap-1.5">
                      <Label>Goal</Label>
                      <Select value={draft.goal} onChange={(e) => setDraft((d) => ({ ...d, goal: e.target.value as GoalOption }))}>
                        {GOALS.map((goal) => (
                          <option key={goal} value={goal}>
                            {goal}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Special instructions</Label>
                      <Textarea
                        value={draft.specialInstructions}
                        onChange={(e) => setDraft((d) => ({ ...d, specialInstructions: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <AiCard title="Using Your Growth Ads Profile" body={`${profile.businessName || 'Your business'} · ${profile.targetAudience || 'Audience pending'} · ${profile.tone || 'Tone pending'}`} />
                    <AiCard title="Suggested Campaign Angle" body={`Lead with ${draft.mainOffer || 'your offer'} and outcome for ${draft.targetAudience || 'your audience'}.`} />
                    <AiCard title="Suggested Offer Improvement" body={draft.mainOffer ? `Add urgency and proof around "${draft.mainOffer}".` : 'Add a clear offer to improve conversion intent.'} />
                    <AiCard title="Suggested Hooks" body={`1) ${draft.mainOffer || 'The offer'} for ${draft.targetAudience || 'your audience'}. 2) Before/after benefit. 3) Fast win CTA.`} />
                    {missingProfile.length > 0 ? (
                      <AiCard title="Missing Context Warning" body={`Complete profile fields: ${missingProfile.slice(0, 4).join(', ')}`} />
                    ) : null}
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {AD_TYPES.map((type) => (
                    <Card key={type} className={`cursor-pointer ${draft.adType === type ? 'border-primary' : ''}`} onClick={() => setDraft((d) => ({ ...d, adType: type }))}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{type}</CardTitle>
                          {type === recommendedAdType ? <Badge variant="default">Recommended</Badge> : null}
                        </div>
                        <CardDescription>{adTypeDescription(type)}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground">Best for: {adTypeBestFor(type)}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-4">
                  <Button onClick={() => void generateThreeOptions()} disabled={loadingGenerate}>
                    {loadingGenerate ? 'Generating…' : 'Generate 3 Ad Options'}
                  </Button>
                  <div className="grid gap-4 md:grid-cols-3">
                    {options.map((option) => (
                      <Card key={option.id}>
                        <CardHeader>
                          <CardTitle className="text-base">{option.optionName}</CardTitle>
                          <CardDescription>{option.adAngle}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <p className="text-muted-foreground">{option.whyThisCouldWork}</p>
                          <p><strong>Headline:</strong> {option.headline}</p>
                          <p><strong>CTA:</strong> {option.cta}</p>
                          <p><strong>Audience:</strong> {option.suggestedAudience}</p>
                          <p><strong>Placement:</strong> {option.suggestedPlacement}</p>
                          <p><strong>Budget:</strong> {option.suggestedBudget}</p>
                          <p><strong>Destination:</strong> {option.destinationSuggestion}</p>
                          <div className="flex flex-wrap gap-2 pt-2">
                            <Button size="sm" onClick={() => setSelectedOptionId(option.id)}>Select This Ad</Button>
                            <Button size="sm" variant="outline" onClick={() => void generateCreative(option, option.creativeType)}>
                              Regenerate Option
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setSelectedOptionId(option.id); setStep(4) }}>
                              Edit Option
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => void saveCreative(option)}>
                              Save Creative
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setSelectedOptionId(option.id); setStep(8) }}>
                              View Preview
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-4">
                  {!selectedOption ? <p className="text-sm text-muted-foreground">Select an ad option first.</p> : (
                    <>
                      <Field label="Primary text" value={selectedOption.primaryText} onChange={(value) => setOptions((current) => current.map((entry) => entry.id === selectedOption.id ? { ...entry, primaryText: value } : entry))} multiline />
                      <Field label="Headline" value={selectedOption.headline} onChange={(value) => setOptions((current) => current.map((entry) => entry.id === selectedOption.id ? { ...entry, headline: value } : entry))} />
                      <Field label="Description" value={selectedOption.description} onChange={(value) => setOptions((current) => current.map((entry) => entry.id === selectedOption.id ? { ...entry, description: value } : entry))} />
                      <Field label="CTA" value={selectedOption.cta} onChange={(value) => setOptions((current) => current.map((entry) => entry.id === selectedOption.id ? { ...entry, cta: value } : entry))} />
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border p-3">
                          <p className="mb-2 text-sm font-medium">Creative</p>
                          {selectedOption.creativePreview ? (
                            selectedOption.creativeType === 'video' ? (
                              <video src={selectedOption.creativePreview} controls className="h-44 w-full rounded-lg object-cover" />
                            ) : (
                              <img src={selectedOption.creativePreview} alt="" className="h-44 w-full rounded-lg object-cover" />
                            )
                          ) : (
                            <div className="flex h-44 items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
                              No creative yet
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => setOptions((c) => c.map((e) => e.id === selectedOption.id ? { ...e, primaryText: `${e.primaryText} (refined)` } : e))}>Rewrite</Button>
                            <Button size="sm" variant="outline" onClick={() => setOptions((c) => c.map((e) => e.id === selectedOption.id ? { ...e, primaryText: e.primaryText.slice(0, 120) } : e))}>Make shorter</Button>
                            <Button size="sm" variant="outline" onClick={() => setOptions((c) => c.map((e) => e.id === selectedOption.id ? { ...e, primaryText: `${e.primaryText} Premium quality and trusted performance.` } : e))}>Make more premium</Button>
                            <Button size="sm" variant="outline" onClick={() => setOptions((c) => c.map((e) => e.id === selectedOption.id ? { ...e, primaryText: `${e.primaryText} Act now.` } : e))}>Add urgency</Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => void generateCreative(selectedOption, 'image')}>
                              Generate new image
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => void generateCreative(selectedOption, 'video')}>
                              Generate new video
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setOptions((current) => [...current, ...current.slice(0, 3).map((e) => ({ ...e, id: crypto.randomUUID(), optionName: `${e.optionName} Variation` }))])}>
                              Generate 3 variations
                            </Button>
                            <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-xs hover:bg-accent">
                              <Upload className="mr-1 h-3 w-3" />
                              Upload asset
                              <input type="file" accept="image/*,video/*" className="hidden" onChange={uploadAsset} />
                            </label>
                          </div>
                          <div className="rounded-lg border p-2">
                            <p className="mb-2 text-xs text-muted-foreground">Replace from Media Library</p>
                            <div className="flex max-h-32 flex-wrap gap-2 overflow-auto">
                              {adsMedia.slice(0, 8).map((asset) => (
                                <button
                                  type="button"
                                  key={asset.id}
                                  onClick={() =>
                                    setOptions((current) =>
                                      current.map((entry) =>
                                        entry.id === selectedOption.id
                                          ? { ...entry, creativePreview: asset.public_url, creativeType: asset.media_type }
                                          : entry,
                                      ),
                                    )
                                  }
                                  className="rounded border px-2 py-1 text-xs"
                                >
                                  Use {asset.media_type}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              {step === 5 ? (
                <div className="space-y-4">
                  <p className="text-sm font-medium">Where should people go after clicking?</p>
                  <div className="flex gap-2">
                    <Button variant={draft.destinationType === 'url' ? 'default' : 'outline'} onClick={() => setDraft((d) => ({ ...d, destinationType: 'url' }))}>My Own URL</Button>
                    <Button variant={draft.destinationType === 'lead_form' ? 'default' : 'outline'} onClick={() => setDraft((d) => ({ ...d, destinationType: 'lead_form' }))}>Meta Lead Form</Button>
                  </div>
                  {draft.destinationType === 'url' ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Destination URL" value={draft.destinationUrl} onChange={(value) => setDraft((d) => ({ ...d, destinationUrl: value }))} />
                      <Field label="Display URL (optional)" value={draft.displayUrl} onChange={(value) => setDraft((d) => ({ ...d, displayUrl: value }))} />
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Form name" value={draft.leadFormName} onChange={(value) => setDraft((d) => ({ ...d, leadFormName: value }))} />
                      <Field label="Intro headline" value={draft.leadFormHeadline} onChange={(value) => setDraft((d) => ({ ...d, leadFormHeadline: value }))} />
                      <Field label="Intro description" value={draft.leadFormDescription} onChange={(value) => setDraft((d) => ({ ...d, leadFormDescription: value }))} multiline />
                      <Field label="Questions" value={draft.leadQuestions} onChange={(value) => setDraft((d) => ({ ...d, leadQuestions: value }))} multiline />
                      <Field label="Privacy policy URL" value={draft.privacyPolicyUrl} onChange={(value) => setDraft((d) => ({ ...d, privacyPolicyUrl: value }))} />
                      <Field label="Thank you message" value={draft.thankYouMessage} onChange={(value) => setDraft((d) => ({ ...d, thankYouMessage: value }))} multiline />
                    </div>
                  )}
                </div>
              ) : null}

              {step === 6 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <Field label="Location" value={draft.location} onChange={(value) => setDraft((d) => ({ ...d, location: value }))} />
                    <Field label="Age range" value={draft.audienceAgeRange} onChange={(value) => setDraft((d) => ({ ...d, audienceAgeRange: value }))} />
                    <Field label="Gender" value={draft.audienceGender} onChange={(value) => setDraft((d) => ({ ...d, audienceGender: value }))} />
                    <Field label="Interests" value={draft.audienceInterests} onChange={(value) => setDraft((d) => ({ ...d, audienceInterests: value }))} />
                    <Field label="Behaviours" value={draft.audienceBehaviours} onChange={(value) => setDraft((d) => ({ ...d, audienceBehaviours: value }))} />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={draft.advantageAudience} onChange={(e) => setDraft((d) => ({ ...d, advantageAudience: e.target.checked }))} />
                      Advantage+ audience
                    </label>
                  </div>
                  <div className="space-y-3">
                    <AiCard title="Suggested Audience From Profile" body={`${profile.targetAudience || 'Set profile audience'}. Location: ${profile.location || 'not set'}`} />
                    <AiCard title="Suggested Interests" body={profile.interests || 'Add interests in AI Profile for better targeting.'} />
                    {draft.audienceInterests.split(',').filter(Boolean).length < 2 ? <AiCard title="Audience Too Broad Warning" body="Add more specific interests or behaviours to improve relevance." /> : null}
                    {draft.audienceInterests.split(',').filter(Boolean).length > 12 ? <AiCard title="Audience Too Narrow Warning" body="Reduce layered interests to avoid limiting reach." /> : null}
                  </div>
                </div>
              ) : null}

              {step === 7 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <Field label="Daily budget" value={draft.dailyBudget} onChange={(value) => setDraft((d) => ({ ...d, dailyBudget: value }))} />
                    <Field label="Lifetime budget" value={draft.lifetimeBudget} onChange={(value) => setDraft((d) => ({ ...d, lifetimeBudget: value }))} />
                    <Field label="Start date" value={draft.startDate} onChange={(value) => setDraft((d) => ({ ...d, startDate: value }))} type="datetime-local" />
                    <Field label="End date" value={draft.endDate} onChange={(value) => setDraft((d) => ({ ...d, endDate: value }))} type="datetime-local" />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={draft.runContinuously} onChange={(e) => setDraft((d) => ({ ...d, runContinuously: e.target.checked }))} />
                      Run continuously
                    </label>
                  </div>
                  <div className="space-y-3">
                    <AiCard title="Recommended Starting Budget" body={`Start around $${Math.max(25, Number(draft.dailyBudget || 0) || 35)}/day for this objective.`} />
                    {Number(draft.dailyBudget || 0) < 15 ? <AiCard title="Budget Too Low Warning" body="Increase budget for stable learning and better optimization." /> : null}
                    <AiCard title="Estimated Reach" body={`Estimated reach: ${Math.max(800, Number(draft.dailyBudget || 35) * 120)} people/day`} />
                    <AiCard title="Estimated Clicks" body={`Estimated clicks: ${Math.max(10, Number(draft.dailyBudget || 35) * 1.8)} /day`} />
                    <AiCard title="Estimated Leads" body={`Estimated leads: ${Math.max(1, Math.round(Number(draft.dailyBudget || 35) / 18))} /day`} />
                  </div>
                </div>
              ) : null}

              {step === 8 ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    {['Facebook Feed', 'Instagram Feed', 'Instagram Story', 'Instagram Reel', 'Facebook Reel'].map((placement) => (
                      <Card key={placement}>
                        <CardHeader>
                          <CardTitle className="text-sm">{placement}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <p className="font-medium">{selectedOption?.headline || 'Select an option'}</p>
                          <p className="line-clamp-3 text-muted-foreground">{selectedOption?.primaryText || 'No copy selected yet.'}</p>
                          {selectedOption?.creativePreview ? (
                            selectedOption.creativeType === 'video' ? (
                              <video src={selectedOption.creativePreview} className="h-28 w-full rounded object-cover" controls />
                            ) : (
                              <img src={selectedOption.creativePreview} className="h-28 w-full rounded object-cover" alt="" />
                            )
                          ) : (
                            <div className="flex h-28 items-center justify-center rounded border text-xs text-muted-foreground">No creative</div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <AiCard title="Brand voice match" body={selectedOption?.primaryText.includes(profile.tone.split(' ')[0] || '') ? 'Good match with profile tone.' : 'Review wording for stronger profile tone alignment.'} />
                    <AiCard title="CTA match" body={`Current CTA: ${selectedOption?.cta || 'None'}. Keep aligned with goal: ${draft.goal}.`} />
                    <AiCard title="Mobile readability" body={(selectedOption?.primaryText.length ?? 0) > 220 ? 'Copy may be long on mobile. Consider a shorter variation.' : 'Mobile readability looks good.'} />
                    <AiCard title="Creative fit warning" body={selectedOption?.creativePreview ? 'Creative is present for selected option.' : 'Add image/video before launch for stronger performance.'} />
                  </div>
                </div>
              ) : null}

              {step === 9 ? (
                <div className="space-y-4">
                  <div className="grid gap-2 text-sm">
                    {[
                      ['Meta account connected', metaConnected],
                      ['AI Profile available', profileCompletion >= 60],
                      ['Brief completed', Boolean(draft.promoting.trim())],
                      ['Ad type selected', Boolean(draft.adType)],
                      ['Ad option selected', Boolean(selectedOption)],
                      ['Copy completed', Boolean(selectedOption?.primaryText.trim())],
                      ['Creative added', Boolean(selectedOption?.creativePreview)],
                      ['Destination selected', Boolean(draft.destinationType === 'lead_form' ? draft.leadFormName : draft.destinationUrl)],
                      ['Audience selected', Boolean(draft.targetAudience.trim())],
                      ['Budget set', Boolean(draft.dailyBudget.trim() || draft.lifetimeBudget.trim())],
                      ['Policy warning check completed', true],
                    ].map(([label, ok]) => (
                      <div key={String(label)} className="flex items-center justify-between rounded border px-3 py-2">
                        <span>{String(label)}</span>
                        <Badge variant={ok ? 'default' : 'secondary'}>{ok ? 'Done' : 'Missing'}</Badge>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <AiCard title="Launch Readiness Score" body={`${launchReadinessScore}% ready`} />
                    <AiCard title="Brand Consistency Check" body={profileCompletion >= 80 ? 'Strong profile alignment.' : 'Complete profile fields for stronger consistency.'} />
                    <AiCard title="Final Optimization Suggestions" body="Use one clear CTA, keep first sentence sharp, and test two creatives." />
                    <AiCard title="Missing Field Warning" body={missingProfile.length ? `Profile missing: ${missingProfile.slice(0, 3).join(', ')}` : 'No critical profile gaps.'} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void launchCampaign()} disabled={loadingLaunch}>
                      {loadingLaunch ? 'Launching…' : 'Launch'}
                    </Button>
                    <Button variant="outline" onClick={() => setActiveTab('analytics')}>View Analytics</Button>
                    <Button variant="outline" onClick={() => { setDraft(DEFAULT_DRAFT); setOptions([]); setSelectedOptionId(null); setStep(1) }}>Create Another Ad</Button>
                    <Button variant="outline" onClick={() => setMessage('Draft duplicated in local auto-save.')}>Duplicate This Ad</Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media" activeValue={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle>Media Library</CardTitle>
              <CardDescription>Every AI-generated ad asset is saved automatically. Reuse across campaigns.</CardDescription>
            </CardHeader>
            <CardContent>
              {adsMedia.length === 0 ? (
                <p className="text-sm text-muted-foreground">No ad assets yet. Generate images or videos in step 3/4.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {adsMedia.map((asset) => {
                    const meta = (asset.metadata ?? {}) as Record<string, unknown>
                    return (
                      <Card key={asset.id}>
                        <CardContent className="space-y-2 p-3 text-xs">
                          {asset.media_type === 'video' ? (
                            <video src={asset.public_url} controls className="h-40 w-full rounded object-cover" />
                          ) : (
                            <img src={asset.public_url} alt="" className="h-40 w-full rounded object-cover" />
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <MetaLine label="id" value={asset.id.slice(0, 8)} />
                            <MetaLine label="type" value={asset.media_type} />
                            <MetaLine label="userId" value={asset.created_by.slice(0, 8)} />
                            <MetaLine label="campaignId" value={String(meta.campaignId ?? '-')} />
                            <MetaLine label="adOptionId" value={String(meta.adOptionId ?? '-')} />
                            <MetaLine label="source" value={asset.source} />
                            <MetaLine label="platformSize" value={String(meta.platformSize ?? '-')} />
                            <MetaLine label="dimensions" value={String(meta.dimensions ?? '-')} />
                            <MetaLine label="duration" value={String(meta.duration ?? '-')} />
                            <MetaLine label="status" value={String(meta.status ?? 'saved')} />
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button size="sm" variant="outline" onClick={() => window.open(asset.public_url, '_blank')}>Preview</Button>
                            <Button size="sm" variant="outline" onClick={() => { if (selectedOptionId) setOptions((current) => current.map((entry) => entry.id === selectedOptionId ? { ...entry, creativePreview: asset.public_url, creativeType: asset.media_type } : entry)); setActiveTab('studio'); setStep(4) }}>Use in Ad</Button>
                            <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(asset.public_url)}>Reuse</Button>
                            <Button size="sm" variant="outline" onClick={() => window.open(asset.public_url, '_blank')}>Download</Button>
                            <Button size="sm" variant="outline" onClick={() => setMessage(asset.prompt || 'No prompt stored.')}>View Prompt</Button>
                            <Button size="sm" variant="outline" onClick={() => setMessage(`Generate Similar uses prompt: ${asset.prompt || 'N/A'}`)}>Generate Similar</Button>
                            <Button size="sm" variant="destructive" onClick={() => void removeMedia(asset.id)}>Delete</Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" activeValue={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle>Analytics</CardTitle>
              <CardDescription>Track spend, clicks, leads, and AI recommendations using your Growth Ads Profile.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Spend" value={`$${(Number(draft.dailyBudget || 35) * 7).toFixed(0)}`} />
                <Metric label="Impressions" value={`${Math.round(Number(draft.dailyBudget || 35) * 120 * 7)}`} />
                <Metric label="Reach" value={`${Math.round(Number(draft.dailyBudget || 35) * 90 * 7)}`} />
                <Metric label="Clicks" value={`${Math.round(Number(draft.dailyBudget || 35) * 1.8 * 7)}`} />
                <Metric label="CTR" value="1.8%" />
                <Metric label="CPC" value="$1.90" />
                <Metric label="Leads" value={`${Math.round(Number(draft.dailyBudget || 35) / 3)}`} />
                <Metric label="Cost per lead" value="$18.00" />
                <Metric label="Purchases" value="8" />
                <Metric label="ROAS" value="2.4x" />
                <Metric label="Engagement" value="1,240" />
                <Metric label="Video views" value="3,920" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <AiCard title="What is working" body="Short direct hooks and clear CTA language are driving stronger click intent." />
                <AiCard title="What is not working" body="Long descriptions with weak offer framing are lowering conversion quality." />
                <AiCard title="Suggested copy improvement" body={`Shift first line to audience pain point for ${profile.targetAudience || 'your core audience'}.`} />
                <AiCard title="Suggested creative improvement" body={`Use ${profile.brandColours || 'consistent brand colors'} and clearer product framing in the first second.`} />
                <AiCard title="Suggested audience change" body="Split broad audience into one interest cluster and one lookalike test." />
                <AiCard title="Suggested budget change" body="Increase winning ad set budget by 15-20% every 48 hours." />
                <AiCard title="Profile improvement suggestion" body={missingProfile.length ? `Complete: ${missingProfile.slice(0, 3).join(', ')}` : 'Profile context is strong. Keep refreshing offer and pain points monthly.'} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogHeader>
          <DialogTitle>Edit AI Profile</DialogTitle>
          <DialogDescription>Profile context powers ad generation, recommendations, and analytics cards.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[70vh] gap-3 overflow-y-auto py-2 sm:grid-cols-2">
          <Field label="Business name" value={profile.businessName} onChange={(value) => setProfile((p) => ({ ...p, businessName: value }))} />
          <Field label="Niche" value={profile.niche} onChange={(value) => setProfile((p) => ({ ...p, niche: value }))} />
          <Field label="Target audience" value={profile.targetAudience} onChange={(value) => setProfile((p) => ({ ...p, targetAudience: value }))} />
          <Field label="Location" value={profile.location} onChange={(value) => setProfile((p) => ({ ...p, location: value }))} />
          <Field label="Tone" value={profile.tone} onChange={(value) => setProfile((p) => ({ ...p, tone: value }))} />
          <div className="grid gap-1.5">
            <Label>Goal</Label>
            <Select value={profile.goal} onChange={(e) => setProfile((p) => ({ ...p, goal: e.target.value as GoalOption }))}>
              {GOALS.map((goal) => (
                <option key={goal} value={goal}>
                  {goal}
                </option>
              ))}
            </Select>
          </div>
          <Field label="Offer / product" value={profile.offer} onChange={(value) => setProfile((p) => ({ ...p, offer: value }))} />
          <div className="grid gap-1.5">
            <Label>Destination preference</Label>
            <Select value={profile.destinationPreference} onChange={(e) => setProfile((p) => ({ ...p, destinationPreference: e.target.value as 'url' | 'lead_form' }))}>
              <option value="url">My Own URL</option>
              <option value="lead_form">Meta Lead Form</option>
            </Select>
          </div>
          <Field label="Landing URL" value={profile.landingUrl} onChange={(value) => setProfile((p) => ({ ...p, landingUrl: value }))} />
          <Field label="Interests" value={profile.interests} onChange={(value) => setProfile((p) => ({ ...p, interests: value }))} />
          <Field label="Pain points" value={profile.painPoints} onChange={(value) => setProfile((p) => ({ ...p, painPoints: value }))} multiline />
          <Field label="Words to avoid" value={profile.wordsToAvoid} onChange={(value) => setProfile((p) => ({ ...p, wordsToAvoid: value }))} />
          <Field label="Brand colours" value={profile.brandColours} onChange={(value) => setProfile((p) => ({ ...p, brandColours: value }))} />
          <Field label="Logo URL" value={profile.logoUrl} onChange={(value) => setProfile((p) => ({ ...p, logoUrl: value }))} />
          <Field label="Creative preferences" value={profile.creativePreferences} onChange={(value) => setProfile((p) => ({ ...p, creativePreferences: value }))} multiline />
        </div>
        <DialogFooter>
          <Badge variant="outline">Completion: {profileCompletion}%</Badge>
          <Button variant="outline" onClick={() => setShowProfileDialog(false)}>
            Cancel
          </Button>
          <Button onClick={() => void saveProfile()}>
            <Save className="mr-2 h-4 w-4" />
            Save Profile
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  type?: string
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {multiline ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}

function AiCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  )
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="truncate">
      <span className="font-medium">{label}:</span> {value}
    </p>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}

function adTypeDescription(type: AdType) {
  if (type === 'Single Image Ad') return 'Simple static creative with one clear message.'
  if (type === 'Video Ad') return 'Motion-first format for stronger storytelling.'
  if (type === 'Carousel Ad') return 'Multiple cards to show features or steps.'
  if (type === 'Story / Reel Ad') return 'Vertical short-form for fast attention.'
  if (type === 'Lead Form Ad') return 'Capture leads directly inside Meta.'
  if (type === 'Website Conversion Ad') return 'Drive high-intent traffic to your website.'
  return 'Social proof and interaction focused.'
}

function adTypeBestFor(type: AdType) {
  if (type === 'Single Image Ad') return 'Fast launches and offer clarity'
  if (type === 'Video Ad') return 'Demos and education'
  if (type === 'Carousel Ad') return 'Showcasing product range'
  if (type === 'Story / Reel Ad') return 'Awareness and reach'
  if (type === 'Lead Form Ad') return 'Lead capture'
  if (type === 'Website Conversion Ad') return 'Sales and checkout actions'
  return 'Engagement growth'
}
*/
