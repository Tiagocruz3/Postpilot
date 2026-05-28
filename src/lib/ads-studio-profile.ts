import { isDemoMode } from '@/lib/demo'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

export type AdsDestinationType = 'custom_url' | 'meta_lead_form'

export type AdsStudioProfile = {
  userId: string
  /** Once true, never show onboarding again unless reset from Settings. */
  onboardingCompleted?: boolean
  /** Resume onboarding where the user left off (1-8). */
  onboardingStep?: number
  /**
   * Facebook Page ids the user has completed onboarding for, within this
   * workspace. Used by the Ads Studio "Posting from" toggle to detect when
   * the user is switching to a Page that hasn't been onboarded yet so we can
   * walk them through onboarding before they publish ads to that Page.
   */
  onboardedPageIds?: string[]
  /**
   * Per-Facebook-Page onboarding snapshots, keyed by Page id. The top-level
   * business/offer/audience/voice/destination/creative fields always reflect
   * the *currently selected* Page; this map preserves each other Page's saved
   * answers so switching Pages (or onboarding a new one) never clobbers the
   * data captured for another Page.
   */
  pageProfiles?: Record<string, AdsPageProfileSections>
  metaConnection: {
    facebookPageId: string
    instagramAccountId: string
    adAccountId: string
    connectedAt: string
  }
  businessProfile: {
    businessName: string
    industry: string
    websiteUrl: string
    businessType: string
  }
  offerProfile: {
    mainProductService: string
    mainOffer: string
    pricePoint: string
    keyBenefits: string
    customerProblemSolved: string
  }
  audienceProfile: {
    description: string
    locations: string
    ageRange: string
    gender: string
    interests: string
    painPoints: string
    desiredOutcome: string
  }
  brandVoice: {
    tone: string
    writingStyle: string
    ctaStyle: string
    wordsToAvoid: string
  }
  leadDestination: {
    type: AdsDestinationType
    defaultUrl: string
  }
  creativePreferences: {
    formats: string[]
    visualStyle: string
    brandColors: string
    logoUrl: string
  }
  aiPreferences: {
    useResearch: boolean
    researchTrends: boolean
    suggestAudiences: boolean
    suggestHooks: boolean
    generateCopy: boolean
    generateImages: boolean
    generateVideos: boolean
    recommendBudget: boolean
    recommendPlacements: boolean
    analyzePerformance: boolean
  }
  completionScore: number
  createdAt: string
  updatedAt: string
}

/**
 * The subset of onboarding fields that are specific to a single Facebook Page.
 * Stored per Page in {@link AdsStudioProfile.pageProfiles} so each Page keeps
 * its own business/offer/audience/voice/destination/creative answers plus its
 * own onboarding-progress flags.
 */
export type AdsPageProfileSections = {
  businessProfile: AdsStudioProfile['businessProfile']
  offerProfile: AdsStudioProfile['offerProfile']
  audienceProfile: AdsStudioProfile['audienceProfile']
  brandVoice: AdsStudioProfile['brandVoice']
  leadDestination: AdsStudioProfile['leadDestination']
  creativePreferences: AdsStudioProfile['creativePreferences']
  onboardingCompleted: boolean
  onboardingStep: number
}

/** Pull the per-Page onboarding sections out of a full profile. */
export function extractPageSections(profile: AdsStudioProfile): AdsPageProfileSections {
  return {
    businessProfile: profile.businessProfile,
    offerProfile: profile.offerProfile,
    audienceProfile: profile.audienceProfile,
    brandVoice: profile.brandVoice,
    leadDestination: profile.leadDestination,
    creativePreferences: profile.creativePreferences,
    onboardingCompleted: Boolean(profile.onboardingCompleted),
    onboardingStep: profile.onboardingStep ?? 1,
  }
}

/** Blank per-Page sections used when a Page begins onboarding from scratch. */
export function emptyPageSections(userId: string): AdsPageProfileSections {
  const base = createDefaultAdsStudioProfile(userId)
  return extractPageSections(base)
}

export function createDefaultAdsStudioProfile(userId: string): AdsStudioProfile {
  return {
    userId,
    onboardingCompleted: false,
    onboardingStep: 1,
    onboardedPageIds: [],
    pageProfiles: {},
    metaConnection: {
      facebookPageId: '',
      instagramAccountId: '',
      adAccountId: '',
      connectedAt: '',
    },
    businessProfile: { businessName: '', industry: '', websiteUrl: '', businessType: '' },
    offerProfile: {
      mainProductService: '',
      mainOffer: '',
      pricePoint: '',
      keyBenefits: '',
      customerProblemSolved: '',
    },
    audienceProfile: {
      description: '',
      locations: '',
      ageRange: '',
      gender: '',
      interests: '',
      painPoints: '',
      desiredOutcome: '',
    },
    brandVoice: { tone: 'Professional', writingStyle: '', ctaStyle: 'Learn more', wordsToAvoid: '' },
    leadDestination: { type: 'custom_url', defaultUrl: '' },
    creativePreferences: {
      formats: ['Image ads'],
      visualStyle: 'Clean and modern',
      brandColors: '',
      logoUrl: '',
    },
    aiPreferences: {
      useResearch: true,
      researchTrends: true,
      suggestAudiences: true,
      suggestHooks: true,
      generateCopy: true,
      generateImages: true,
      generateVideos: true,
      recommendBudget: true,
      recommendPlacements: true,
      analyzePerformance: true,
    },
    completionScore: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function computeAdsProfileCompletion(profile: AdsStudioProfile): number {
  const hasBusiness = Boolean(
    profile.businessProfile.businessName &&
      profile.businessProfile.industry &&
      profile.businessProfile.websiteUrl,
  )
  const hasOffer = Boolean(
    profile.offerProfile.mainProductService &&
      profile.offerProfile.mainOffer &&
      profile.offerProfile.keyBenefits,
  )
  const hasAudience = Boolean(
    profile.audienceProfile.description &&
      profile.audienceProfile.locations &&
      profile.audienceProfile.interests,
  )
  const hasVoice = Boolean(
    profile.brandVoice.tone && profile.brandVoice.writingStyle && profile.brandVoice.ctaStyle,
  )
  const hasDestination = Boolean(
    profile.leadDestination.type &&
      (profile.leadDestination.type === 'meta_lead_form' || profile.leadDestination.defaultUrl),
  )
  const hasCreative = Boolean(
    profile.creativePreferences.formats.length && profile.creativePreferences.visualStyle,
  )
  const hasAi = Object.values(profile.aiPreferences).some(Boolean)
  const hasMeta = Boolean(
    profile.metaConnection.facebookPageId ||
      profile.metaConnection.instagramAccountId ||
      profile.metaConnection.adAccountId ||
      profile.metaConnection.connectedAt,
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
}

export function isAdsOnboardingComplete(profile: AdsStudioProfile): boolean {
  return computeAdsProfileCompletion(profile) >= 70
}

export async function fetchAdsStudioProfile(
  workspaceId: string | null,
  userId: string | undefined,
): Promise<AdsStudioProfile | null> {
  if (!workspaceId || !userId) return null
  if (isDemoMode) return null

  const { data, error } = await supabase
    .from('meta_ads_onboarding')
    .select('answers')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  const raw = (data as { answers?: Partial<AdsStudioProfile> } | null)?.answers ?? null
  if (!raw) return null

  // Older rows may not include every field (or even userId). Normalize to the latest schema
  // so onboarding-complete flags and defaults survive across updates.
  const base = createDefaultAdsStudioProfile(userId)
  const rawStep = typeof raw.onboardingStep === 'number' ? raw.onboardingStep : Number(raw.onboardingStep)
  const normalizedStep = Number.isFinite(rawStep) ? Math.max(1, Math.min(8, Math.round(rawStep))) : 1
  // Migrate older rows that completed onboarding before we tracked per-Page
  // status: if onboarding is marked complete and we know the Page id used at
  // the time, treat that Page as already onboarded so the user isn't prompted
  // to redo onboarding for the Page they are already publishing from.
  const rawOnboardedPageIds = Array.isArray(raw.onboardedPageIds)
    ? raw.onboardedPageIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  const fallbackPageId = raw.metaConnection?.facebookPageId
  const onboardedPageIds =
    rawOnboardedPageIds.length === 0 && raw.onboardingCompleted && fallbackPageId
      ? [fallbackPageId]
      : rawOnboardedPageIds

  const normalized: AdsStudioProfile = {
    ...base,
    ...raw,
    userId,
    metaConnection: { ...base.metaConnection, ...(raw.metaConnection ?? {}) },
    businessProfile: { ...base.businessProfile, ...(raw.businessProfile ?? {}) },
    offerProfile: { ...base.offerProfile, ...(raw.offerProfile ?? {}) },
    audienceProfile: { ...base.audienceProfile, ...(raw.audienceProfile ?? {}) },
    brandVoice: { ...base.brandVoice, ...(raw.brandVoice ?? {}) },
    leadDestination: { ...base.leadDestination, ...(raw.leadDestination ?? {}) },
    creativePreferences: { ...base.creativePreferences, ...(raw.creativePreferences ?? {}) },
    aiPreferences: { ...base.aiPreferences, ...(raw.aiPreferences ?? {}) },
    onboardingCompleted: Boolean(raw.onboardingCompleted),
    onboardingStep: normalizedStep,
    onboardedPageIds,
    pageProfiles:
      raw.pageProfiles && typeof raw.pageProfiles === 'object' ? { ...raw.pageProfiles } : {},
  }

  // Seed a snapshot for the currently selected Page so a legacy profile (one
  // captured before per-Page storage existed) doesn't lose its answers the
  // first time the user switches Pages.
  if (fallbackPageId && !normalized.pageProfiles?.[fallbackPageId] && raw.onboardingCompleted) {
    normalized.pageProfiles = {
      ...(normalized.pageProfiles ?? {}),
      [fallbackPageId]: extractPageSections(normalized),
    }
  }

  return normalized
}

export async function saveAdsStudioProfile(
  workspaceId: string,
  userId: string,
  profile: AdsStudioProfile,
): Promise<AdsStudioProfile> {
  const payload: AdsStudioProfile = {
    ...profile,
    userId,
    completionScore: computeAdsProfileCompletion(profile),
    updatedAt: new Date().toISOString(),
    createdAt: profile.createdAt || new Date().toISOString(),
  }

  if (isDemoMode) return payload

  const { error } = await supabase.from('meta_ads_onboarding').upsert(
    {
      workspace_id: workspaceId,
      user_id: userId,
      answers: payload as unknown as Json,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: 'user_id,workspace_id' },
  )

  if (error) throw error
  return payload
}

export async function resetAdsStudioProfile(workspaceId: string, userId: string): Promise<AdsStudioProfile> {
  const fresh = createDefaultAdsStudioProfile(userId)
  return saveAdsStudioProfile(workspaceId, userId, fresh)
}

export const ADS_PROFILE_SECTIONS = [
  { key: 'business', label: 'Business profile', check: (p: AdsStudioProfile) => Boolean(p.businessProfile.businessName && p.businessProfile.industry) },
  { key: 'offer', label: 'Offer / service', check: (p: AdsStudioProfile) => Boolean(p.offerProfile.mainOffer && p.offerProfile.mainProductService) },
  { key: 'audience', label: 'Target audience', check: (p: AdsStudioProfile) => Boolean(p.audienceProfile.description && p.audienceProfile.locations) },
  { key: 'voice', label: 'Brand voice', check: (p: AdsStudioProfile) => Boolean(p.brandVoice.tone && p.brandVoice.writingStyle) },
  { key: 'destination', label: 'Lead destination', check: (p: AdsStudioProfile) => Boolean(p.leadDestination.type) },
  { key: 'creative', label: 'Creative preferences', check: (p: AdsStudioProfile) => Boolean(p.creativePreferences.visualStyle) },
  { key: 'meta', label: 'Meta connection', check: (p: AdsStudioProfile) => Boolean(p.metaConnection.adAccountId || p.metaConnection.facebookPageId) },
] as const
