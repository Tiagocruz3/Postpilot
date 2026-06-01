import { ChevronLeft, ChevronRight, Loader2, RefreshCw, RotateCcw, Sparkles, Trophy, Upload, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AdsAudienceFields, type AudienceProfileFields } from '@/components/ads/AdsAudienceFields'
import { AdsReachPanel } from '@/components/ads/AdsReachPanel'
import { AdsSelectField } from '@/components/ads/AdsSelectField'
import {
  AdsTargetingSuggestions,
  type AdsTargetingSuggestion,
} from '@/components/ads/AdsTargetingSuggestions'
import {
  AD_PLACEMENTS,
  FacebookAdPreview,
  type AdDevice,
  type AdPlacement,
} from '@/components/ads/FacebookAdPreview'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { parseInterestList } from '@/lib/ads-targeting-options'
import {
  DAILY_BUDGET_OPTIONS,
  META_AD_FORMATS,
  META_CAMPAIGN_OBJECTIVES,
  PLACEMENT_OPTIONS,
} from '@/lib/ads-targeting-options'
import { cn } from '@/lib/utils'

export type CampaignDraft = {
  campaignName: string
  promoting: string
  goal: string
  adType: string
  audience: string
  location: string
  tone: string
  destinationUrl: string
  dailyBudget: string
  placements: string
  ageMin?: number
  ageMax?: number
  genders?: string[]
  behaviours?: string[]
  scheduleStart?: string
  scheduleEnd?: string
  budgetType?: 'daily' | 'lifetime'
  lifetimeBudget?: string
  audienceSize?: 'narrow' | 'balanced' | 'broad'
}

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

export type AdRecommendation = {
  preferredVariant: string
  reason: string
} | null

export type StudioStepId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

type AdsCampaignStudioProps = {
  draft: CampaignDraft
  onDraftChange: (patch: Partial<CampaignDraft>) => void
  audienceProfile: AudienceProfileFields
  onAudienceProfileChange: (next: AudienceProfileFields) => void
  businessName: string
  defaultDestinationUrl: string
  destinationType: 'custom_url' | 'meta_lead_form'
  brandTone: string
  brandCta: string
  recommendedAdTypes: string[]
  /** Public Facebook page id used to load a real page avatar into previews. */
  facebookPageId?: string | null
  options: AdOption[]
  selectedId: string | null
  onSelectOption: (id: string) => void
  onUpdateOption: (id: string, patch: Partial<AdOption>) => void
  onGenerateOptions: () => Promise<void>
  /** Regenerate a single variant in place (keeps the other untouched). */
  onRegenerateVariant?: (variantId: string) => Promise<void>
  /** AI's pick of which variant should perform better and why. */
  variantRecommendation?: AdRecommendation
  onGenerateCreative: (type: 'image' | 'video') => Promise<void>
  /** Upload a user-supplied image to replace the selected variant's media. */
  onUploadImage?: (optionId: string, file: File) => Promise<void>
  onSuggestAudience: () => Promise<void>
  /** AI-recommended targeting suggestions with reasoning per field. */
  targetingSuggestions?: AdsTargetingSuggestion[]
  /** Apply a single suggestion. */
  onApplyTargetingSuggestion?: (suggestion: AdsTargetingSuggestion) => void
  /** Apply every suggestion in one shot. */
  onApplyAllTargetingSuggestions?: () => void
  onEditProfile: () => void
  metaReady?: boolean
  onPublish?: () => Promise<void> | void
  generatingCopy?: boolean
  /** IDs of variants whose image / video creative is still being generated. */
  generatingMediaIds?: string[]
  suggestingAudience?: boolean
  aiTip?: string
  /** Optional controlled step. If omitted the studio manages its own step locally. */
  step?: StudioStepId
  onStepChange?: (step: StudioStepId) => void
  /** Optional reset handler. When provided, a "Start over" button is shown in the side nav. */
  onReset?: () => void | Promise<void>
}

const STUDIO_STEPS = [
  { id: 1, label: 'Goal', meta: 'What you want to achieve' },
  { id: 2, label: 'Offer', meta: 'What you are promoting' },
  { id: 3, label: 'Variants', meta: 'Generate 2 ad versions' },
  { id: 4, label: 'Edit', meta: 'Copy + creative + preview' },
  { id: 5, label: 'Targeting', meta: 'Audience, budget, schedule' },
  { id: 6, label: 'Destination', meta: 'Form or website link' },
  { id: 7, label: 'Preview', meta: 'Single placement preview' },
  { id: 8, label: 'Placements', meta: 'Switch between every Meta surface' },
  { id: 9, label: 'Publish', meta: 'Send to Meta Ads' },
] as const

export function AdsCampaignStudio({
  draft,
  onDraftChange,
  audienceProfile,
  onAudienceProfileChange,
  businessName,
  defaultDestinationUrl,
  destinationType,
  brandTone,
  brandCta,
  recommendedAdTypes,
  facebookPageId,
  options,
  selectedId,
  onSelectOption,
  onUpdateOption,
  onGenerateOptions,
  onRegenerateVariant,
  variantRecommendation,
  onGenerateCreative,
  onUploadImage,
  onSuggestAudience,
  targetingSuggestions,
  onApplyTargetingSuggestion,
  onApplyAllTargetingSuggestions,
  onEditProfile,
  metaReady = false,
  onPublish,
  generatingCopy = false,
  generatingMediaIds,
  suggestingAudience = false,
  aiTip,
  step: controlledStep,
  onStepChange,
  onReset,
}: AdsCampaignStudioProps) {
  const [internalStep, setInternalStep] = useState<StudioStepId>(1)
  const step = controlledStep ?? internalStep
  const setStep = (next: StudioStepId | ((prev: StudioStepId) => StudioStepId)) => {
    const nextValue = typeof next === 'function' ? (next as (prev: StudioStepId) => StudioStepId)(step) : next
    if (onStepChange) onStepChange(nextValue)
    if (controlledStep === undefined) setInternalStep(nextValue)
  }
  const [assistantPrompt, setAssistantPrompt] = useState('')
  const [previewPlacement, setPreviewPlacement] = useState<AdPlacement>('facebook-feed')
  const [previewDevice, setPreviewDevice] = useState<AdDevice>('mobile')
  const [regeneratingVariantId, setRegeneratingVariantId] = useState<string | null>(null)
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const stepButtonRefs = useRef<Partial<Record<StudioStepId, HTMLButtonElement | null>>>({})
  const skipStepScrollRef = useRef(true)
  const selectedOption = options.find((option) => option.id === selectedId) ?? null
  const destinationDomain = useMemo(() => {
    if (!draft.destinationUrl) return ''
    try {
      return new URL(draft.destinationUrl).hostname.replace(/^www\./, '')
    } catch {
      return draft.destinationUrl.replace(/^https?:\/\//, '').split('/')[0]
    }
  }, [draft.destinationUrl])
  const facebookPageAvatarUrl = useMemo(() => {
    if (!facebookPageId) return null
    return `https://graph.facebook.com/${encodeURIComponent(facebookPageId)}/picture?type=large`
  }, [facebookPageId])

  const handleRegenerateVariant = async (id: string) => {
    if (!onRegenerateVariant) return
    setRegeneratingVariantId(id)
    try {
      await onRegenerateVariant(id)
    } finally {
      setRegeneratingVariantId(null)
    }
  }

  const handleUploadImage = async (optionId: string, file: File | null | undefined) => {
    if (!file || !onUploadImage) return
    setUploadingImageId(optionId)
    try {
      await onUploadImage(optionId, file)
    } finally {
      setUploadingImageId(null)
    }
  }

  const objective = useMemo(
    () => META_CAMPAIGN_OBJECTIVES.find((item) => item.value === draft.goal),
    [draft.goal]
  )

  const ageMin = draft.ageMin ?? 25
  const ageMax = draft.ageMax ?? 54
  const genders = draft.genders ?? []
  const budgetType = draft.budgetType ?? 'daily'
  const lifetimeBudget = draft.lifetimeBudget ?? ''
  const audienceSize = draft.audienceSize ?? 'balanced'
  const behaviours = draft.behaviours ?? []
  const scheduleStart = draft.scheduleStart ?? ''
  const scheduleEnd = draft.scheduleEnd ?? ''

  const durationDays = useMemo(() => {
    if (!scheduleStart || !scheduleEnd) return 7
    const start = new Date(scheduleStart).getTime()
    const end = new Date(scheduleEnd).getTime()
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 7
    return Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)))
  }, [scheduleStart, scheduleEnd])

  const reachInputs = useMemo(
    () => ({
      dailyBudget: Number(draft.dailyBudget || 0) || 0,
      lifetimeBudget: Number(lifetimeBudget || 0) || 0,
      budgetType,
      durationDays,
      location: draft.location,
      ageMin,
      ageMax,
      genders,
      interests: parseInterestList(audienceProfile.interests ?? ''),
      behaviours,
      objective: draft.goal,
      placements: draft.placements,
      adFormat: draft.adType,
      audienceSize,
    }),
    [
      draft.dailyBudget,
      lifetimeBudget,
      budgetType,
      durationDays,
      draft.location,
      ageMin,
      ageMax,
      genders,
      audienceProfile.interests,
      behaviours,
      draft.goal,
      draft.placements,
      draft.adType,
      audienceSize,
    ],
  )

  const toggleGender = (value: string) => {
    const set = new Set(genders)
    if (set.has(value)) set.delete(value)
    else set.add(value)
    onDraftChange({ genders: Array.from(set) })
  }

  const nextReason = (() => {
    if (step === 1 && !draft.goal) return 'Choose a goal first.'
    if (step === 2 && !draft.promoting.trim()) return 'Tell us what you’re promoting.'
    if (step === 3 && options.length === 0) return 'Click “Generate ad variants” to create two versions.'
    if (step === 4 && !selectedOption) return 'Pick a variant from the previous step.'
    if (step === 5 && (!draft.location || !draft.dailyBudget)) return 'Add a location and daily budget.'
    if (step === 6 && destinationType !== 'meta_lead_form' && !draft.destinationUrl.trim()) {
      return 'Add a destination URL or use a Meta lead form.'
    }
    return ''
  })()
  const canNext = !nextReason

  // When the user advances (Continue), goes back, or picks a step pill, scroll
  // the studio so the step bar sits at the top and the active pill stays
  // visible in the horizontal row — they can then work down through the step.
  useEffect(() => {
    if (skipStepScrollRef.current) {
      skipStepScrollRef.current = false
      return
    }
    const scroller = (navRef.current?.closest('main') ?? document.querySelector('main')) as HTMLElement | null
    // Run after the new step's content has rendered so the scroll target is right.
    requestAnimationFrame(() => {
      // Vertical: bring the step bar to the top so the user works straight down.
      scroller?.scrollTo({ top: 0, behavior: 'smooth' })
      // Horizontal: centre the active pill on its own row only. Using
      // scrollIntoView here would cancel the vertical scroll-to-top above
      // (both act on `main`), which is why navigation felt stuck mid-page.
      const pill = stepButtonRefs.current[step]
      const row = pill?.parentElement
      if (pill && row && row.scrollWidth > row.clientWidth + 1) {
        const pillRect = pill.getBoundingClientRect()
        const rowRect = row.getBoundingClientRect()
        const delta = pillRect.left + pillRect.width / 2 - (rowRect.left + rowRect.width / 2)
        row.scrollBy({ left: delta, behavior: 'smooth' })
      }
    })
  }, [step])

  return (
    <div className="space-y-4">
      <nav ref={navRef} className="rounded-xl border bg-card p-2 lg:sticky lg:top-0 lg:z-20">
        <div className="flex items-center gap-2">
          <div className="-mx-1 flex flex-1 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {STUDIO_STEPS.map((item) => {
              const active = step === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  ref={(el) => {
                    stepButtonRefs.current[item.id] = el
                  }}
                  onClick={() => setStep(item.id)}
                  className={cn(
                    'group flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                    active ? 'bg-[#1877F2]/10 text-[#1877F2]' : 'text-foreground/80 hover:bg-muted',
                  )}
                  title={item.meta}
                >
                  <span
                    className={cn(
                      'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                      active
                        ? 'bg-[#1877F2] text-white'
                        : 'bg-muted text-muted-foreground group-hover:bg-muted-foreground/20',
                    )}
                  >
                    {item.id}
                  </span>
                  <span className="whitespace-nowrap font-medium">{item.label}</span>
                </button>
              )
            })}
          </div>

          <div className="ml-1 hidden shrink-0 items-center gap-2 border-l pl-2 lg:flex">
            <div className="text-right leading-tight">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Business</p>
              <p className="max-w-[180px] truncate text-xs font-medium">{businessName || 'Your business'}</p>
            </div>
            {onReset ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive"
                onClick={() => void onReset()}
                title="Clear the current campaign draft and start a new one"
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Reset
              </Button>
            ) : null}
          </div>
        </div>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
        {step === 1 ? (
          <Card className="border-0 shadow-sm ring-1 ring-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">What do you want this ad to achieve?</CardTitle>
              <CardDescription>Choose a goal. We’ll guide you step-by-step and generate 3 ready-to-launch options.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {META_CAMPAIGN_OBJECTIVES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onDraftChange({ goal: item.value })}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-all',
                      draft.goal === item.value ? 'border-[#1877F2] bg-[#1877F2]/5 ring-1 ring-[#1877F2]/30' : 'hover:border-muted-foreground/30'
                    )}
                  >
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
                  </button>
                ))}
              </div>
              <div className="rounded-xl border bg-muted/20 p-4 text-sm">
                <p className="font-medium text-foreground">Recommended</p>
                <p className="mt-1 text-muted-foreground">
                  For most businesses, <strong>Leads</strong> is the fastest way to get enquiries, bookings, or calls.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 2 ? (
          <Card className="border-0 shadow-sm ring-1 ring-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">What are you promoting?</CardTitle>
              <CardDescription>Describe your product, service, or offer in one sentence.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-1.5">
                <Label>Campaign name</Label>
                <Input
                  value={draft.campaignName}
                  onChange={(event) => onDraftChange({ campaignName: event.target.value })}
                  placeholder={`${businessName || 'Brand'} — ${draft.goal || 'Campaign'}`}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Product / service</Label>
                <Input
                  value={draft.promoting}
                  onChange={(event) => onDraftChange({ promoting: event.target.value })}
                  placeholder="e.g. Free quote for kitchen renovations"
                />
              </div>
              <AdsSelectField
                label="What should your ad look like?"
                value={draft.adType}
                onChange={(adType) => onDraftChange({ adType })}
                options={META_AD_FORMATS}
                placeholder="Choose a format"
              />
              {recommendedAdTypes.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-3 text-sm">
                  <span className="text-muted-foreground">Suggested formats:</span>
                  {recommendedAdTypes.slice(0, 3).map((type) => (
                    <Badge key={type} variant="outline" className="cursor-pointer" onClick={() => onDraftChange({ adType: type })}>
                      {type}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <Card className="border-0 shadow-sm ring-1 ring-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Generate 2 ad variants with AI</CardTitle>
                <CardDescription>
                  We'll create two different angles — pick the one you like, edit either, or regenerate just one.
                  Both variants are saved to your Ad Library.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => void onGenerateOptions()}
                  disabled={generatingCopy || !draft.promoting.trim()}
                  className="bg-[#1877F2] hover:bg-[#166fe0]"
                >
                  {generatingCopy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {options.length > 0 ? 'Generate fresh variants' : 'Generate ad variants'}
                </Button>

                {variantRecommendation ? (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                    <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        AI pick: <span className="font-semibold">{variantRecommendation.preferredVariant}</span>
                      </p>
                      <p className="mt-0.5 text-muted-foreground">{variantRecommendation.reason}</p>
                    </div>
                  </div>
                ) : null}

                {options.length === 0 && !generatingCopy ? (
                  <p className="text-sm text-muted-foreground">No variants yet — click Generate to create two side-by-side.</p>
                ) : null}

                {options.length === 0 && generatingCopy ? (
                  <div className="grid gap-8 sm:grid-cols-2">
                    {[0, 1].map((index) => (
                      <VariantSkeletonCard
                        key={`skeleton-${index}`}
                        label={index === 0 ? 'Variant A' : 'Variant B'}
                        mediaType={draft.adType === 'Video Ad' ? 'video' : 'image'}
                      />
                    ))}
                  </div>
                ) : null}

                {options.length > 0 ? (
                  <div className="grid items-start gap-8 sm:grid-cols-2">
                    {options.map((option) => {
                      const isSelected = selectedId === option.id
                      const isRecommended =
                        variantRecommendation?.preferredVariant?.toLowerCase() === option.name.toLowerCase()
                      const isRegenerating = regeneratingVariantId === option.id
                      const mediaLoading =
                        (generatingMediaIds?.includes(option.id) ?? false) || (!option.previewUrl && isRegenerating)
                      // A variant is only "ready" once both copy and media are
                      // present and nothing is still being generated for it.
                      const hasCopy = Boolean(option.headline?.trim() && option.primaryText?.trim())
                      const isReady = hasCopy && Boolean(option.previewUrl) && !mediaLoading
                      return (
                        <div
                          key={option.id}
                          className={cn(
                            'alive-enter flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-sm transition-all',
                            isSelected ? 'border-[#1877F2] ring-2 ring-[#1877F2]/20' : 'hover:shadow-md',
                            !isReady && 'border-dashed',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-[#1877F2]">
                                  {option.name}
                                </p>
                                {!isReady ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Generating {option.previewType}…
                                  </span>
                                ) : null}
                              </div>
                              {option.angle ? (
                                <p className="text-[11px] text-muted-foreground capitalize">{option.angle.replace(/-/g, ' ')} angle</p>
                              ) : null}
                            </div>
                            {isRecommended ? (
                              <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                <Trophy className="mr-1 h-3 w-3" />
                                AI pick
                              </Badge>
                            ) : null}
                          </div>

                          <FacebookAdPreview
                            data={{
                              pageName: businessName || 'Your Page',
                              pageAvatarUrl: facebookPageAvatarUrl,
                              primaryText: option.primaryText,
                              headline: option.headline,
                              description: option.description,
                              cta: option.cta,
                              mediaUrl: option.previewUrl,
                              mediaType: option.previewType,
                              destinationDomain,
                            }}
                            placement="facebook-feed"
                            device="mobile"
                            mediaLoading={mediaLoading}
                          />

                          {option.targetingAngle ? (
                            <p className="rounded-lg bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground">Best audience:</span> {option.targetingAngle}
                            </p>
                          ) : null}

                          <div className="mt-auto flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              className={cn('flex-1', isSelected ? 'bg-[#1877F2] hover:bg-[#166fe0]' : '')}
                              variant={isSelected ? 'default' : 'outline'}
                              onClick={() => onSelectOption(option.id)}
                              disabled={mediaLoading}
                            >
                              {mediaLoading
                                ? `Finishing ${option.previewType}…`
                                : isSelected
                                  ? 'Selected'
                                  : 'Use this ad'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleRegenerateVariant(option.id)}
                              disabled={isRegenerating || !onRegenerateVariant || mediaLoading}
                            >
                              {isRegenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : null}

                {options.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2.5 text-sm">
                    {selectedOption ? (
                      <p className="text-muted-foreground">
                        Selected{' '}
                        <span className="font-semibold text-foreground">{selectedOption.name}</span>. Click{' '}
                        <span className="font-semibold text-foreground">Continue</span> below to edit it — or pick the
                        other variant first.
                      </p>
                    ) : (
                      <p className="text-muted-foreground">
                        Choose the ad you want to run with <span className="font-medium text-foreground">Use this ad</span>,
                        then click Continue.
                      </p>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {step === 4 ? (
          <Card className="border-0 shadow-sm ring-1 ring-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Edit your ad</CardTitle>
              <CardDescription>
                Rewrite the copy and creative — the live preview on the right updates instantly across every placement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedOption ? (
                <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                  Select an ad variant in the previous step.
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
                  {/* Editor column */}
                  <div className="space-y-5">
                    {/* Copy */}
                    <section className="space-y-3 rounded-xl border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">Ad copy</h3>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() =>
                            onUpdateOption(selectedOption.id, {
                              primaryText: `${selectedOption.primaryText}\n\n${brandTone} tone · CTA: ${brandCta}.`,
                            })
                          }
                        >
                          <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                          Rewrite tone
                        </Button>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Headline</Label>
                        <Input
                          value={selectedOption.headline}
                          onChange={(event) => onUpdateOption(selectedOption.id, { headline: event.target.value })}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Primary text</Label>
                        <Textarea
                          value={selectedOption.primaryText}
                          onChange={(event) => onUpdateOption(selectedOption.id, { primaryText: event.target.value })}
                          rows={4}
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                          <Label>Description</Label>
                          <Input
                            value={selectedOption.description ?? ''}
                            onChange={(event) => onUpdateOption(selectedOption.id, { description: event.target.value })}
                            placeholder="Optional secondary line"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label>Call to action</Label>
                          <Input
                            value={selectedOption.cta}
                            onChange={(event) => onUpdateOption(selectedOption.id, { cta: event.target.value })}
                          />
                        </div>
                      </div>
                    </section>

                    {/* Creative */}
                    <section className="space-y-3 rounded-xl border p-4">
                      <div>
                        <h3 className="text-sm font-semibold">Creative</h3>
                        <p className="text-xs text-muted-foreground">
                          Regenerate the visual, or spin up a brand-new variant with a different angle.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void onGenerateCreative('image')}
                          disabled={generatingMediaIds?.includes(selectedOption.id) ?? false}
                        >
                          {generatingMediaIds?.includes(selectedOption.id) && selectedOption.previewType === 'image' ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 h-3.5 w-3.5" />
                          )}
                          Regenerate image
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void onGenerateCreative('video')}
                          disabled={generatingMediaIds?.includes(selectedOption.id) ?? false}
                        >
                          {generatingMediaIds?.includes(selectedOption.id) && selectedOption.previewType === 'video' ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 h-3.5 w-3.5" />
                          )}
                          Regenerate video
                        </Button>
                        {onUploadImage ? (
                          <>
                            <input
                              ref={uploadInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(event) => {
                                void handleUploadImage(selectedOption.id, event.target.files?.[0])
                                event.target.value = ''
                              }}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => uploadInputRef.current?.click()}
                              disabled={uploadingImageId === selectedOption.id}
                              title="Replace the AI image with your own"
                            >
                              {uploadingImageId === selectedOption.id ? (
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Upload className="mr-2 h-3.5 w-3.5" />
                              )}
                              Upload image
                            </Button>
                          </>
                        ) : null}
                        {onRegenerateVariant ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleRegenerateVariant(selectedOption.id)}
                            disabled={regeneratingVariantId === selectedOption.id}
                          >
                            {regeneratingVariantId === selectedOption.id ? (
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Wand2 className="mr-2 h-3.5 w-3.5" />
                            )}
                            New angle
                          </Button>
                        ) : null}
                      </div>
                    </section>
                  </div>

                  {/* Preview column */}
                  <div className="lg:sticky lg:top-4 lg:self-start">
                    <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Live preview</p>
                      <PreviewPlacementSwitcher
                        placement={previewPlacement}
                        device={previewDevice}
                        onPlacementChange={setPreviewPlacement}
                        onDeviceChange={setPreviewDevice}
                      />
                      <FacebookAdPreview
                        data={{
                          pageName: businessName || 'Your Page',
                          pageAvatarUrl: facebookPageAvatarUrl,
                          primaryText: selectedOption.primaryText,
                          headline: selectedOption.headline,
                          description: selectedOption.description,
                          cta: selectedOption.cta,
                          mediaUrl: selectedOption.previewUrl,
                          mediaType: selectedOption.previewType,
                          destinationDomain,
                        }}
                        placement={previewPlacement}
                        device={previewDevice}
                        mediaLoading={generatingMediaIds?.includes(selectedOption.id) ?? false}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4">
            {onApplyTargetingSuggestion && onApplyAllTargetingSuggestions ? (
              <AdsTargetingSuggestions
                loading={suggestingAudience}
                suggestions={targetingSuggestions ?? []}
                onApply={onApplyTargetingSuggestion}
                onApplyAll={onApplyAllTargetingSuggestions}
                onRefresh={() => void onSuggestAudience()}
              />
            ) : null}

            <Card className="border-0 shadow-sm ring-1 ring-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Targeting</CardTitle>
                <CardDescription>
                  Edit any field. Estimated reach in the sidebar updates as you change targeting or budget.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <AdsAudienceFields
                  value={audienceProfile}
                  onChange={(next) => {
                    onAudienceProfileChange(next)
                    onDraftChange({
                      audience: next.description,
                      location: next.locations,
                    })
                  }}
                  onSuggestAi={onSuggestAudience}
                  aiLoading={suggestingAudience}
                  hideAgeAndGender
                  hidePainAndOutcome
                />

                <div className="grid gap-4 rounded-xl border bg-muted/15 p-4">
                  <div>
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Age range
                    </Label>
                    <div className="mt-2 flex items-center gap-3">
                      <Input
                        type="number"
                        min={13}
                        max={ageMax}
                        value={ageMin}
                        onChange={(event) => {
                          const next = Math.max(13, Math.min(ageMax, Number(event.target.value) || 13))
                          onDraftChange({ ageMin: next })
                        }}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">to</span>
                      <Input
                        type="number"
                        min={ageMin}
                        max={65}
                        value={ageMax}
                        onChange={(event) => {
                          const next = Math.max(ageMin, Math.min(65, Number(event.target.value) || 65))
                          onDraftChange({ ageMax: next })
                        }}
                        className="w-20"
                      />
                      <span className="ml-1 text-xs text-muted-foreground">years</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Gender
                    </Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(['Women', 'Men'] as const).map((value) => {
                        const selected = genders.includes(value)
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => toggleGender(value)}
                            className={cn(
                              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                              selected
                                ? 'border-[#1877F2] bg-[#1877F2]/10 text-[#1877F2]'
                                : 'hover:bg-muted',
                            )}
                          >
                            {value}
                          </button>
                        )
                      })}
                      <button
                        type="button"
                        onClick={() => onDraftChange({ genders: [] })}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                          genders.length === 0 ? 'border-[#1877F2] bg-[#1877F2]/10 text-[#1877F2]' : 'hover:bg-muted',
                        )}
                      >
                        All genders
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Audience size
                    </Label>
                    <div className="mt-2 inline-flex rounded-full border p-0.5">
                      {(['narrow', 'balanced', 'broad'] as const).map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => onDraftChange({ audienceSize: size })}
                          className={cn(
                            'rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors',
                            audienceSize === size ? 'bg-[#1877F2] text-white' : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Narrow = highly specific, broad = let Meta find buyers across a wide pool.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 rounded-xl border bg-muted/15 p-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Budget type
                    </Label>
                    <div className="mt-2 inline-flex rounded-full border p-0.5">
                      {(['daily', 'lifetime'] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => onDraftChange({ budgetType: value })}
                          className={cn(
                            'rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors',
                            budgetType === value ? 'bg-[#1877F2] text-white' : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {value} budget
                        </button>
                      ))}
                    </div>
                  </div>

                  {budgetType === 'daily' ? (
                    <AdsSelectField
                      label="Daily budget"
                      value={draft.dailyBudget}
                      onChange={(dailyBudget) => onDraftChange({ dailyBudget })}
                      options={DAILY_BUDGET_OPTIONS}
                    />
                  ) : (
                    <div className="grid gap-1.5">
                      <Label>Lifetime budget (USD)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={lifetimeBudget}
                        onChange={(event) => onDraftChange({ lifetimeBudget: event.target.value })}
                        placeholder="e.g. 500"
                      />
                    </div>
                  )}

                  <AdsSelectField
                    label="Placements"
                    value={draft.placements}
                    onChange={(placements) => onDraftChange({ placements })}
                    options={PLACEMENT_OPTIONS}
                  />

                  <div className="grid gap-1.5">
                    <Label>Start date</Label>
                    <Input
                      type="date"
                      value={scheduleStart}
                      onChange={(event) => onDraftChange({ scheduleStart: event.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>End date (optional)</Label>
                    <Input
                      type="date"
                      value={scheduleEnd}
                      onChange={(event) => onDraftChange({ scheduleEnd: event.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {step === 6 ? (
          <Card className="border-0 shadow-sm ring-1 ring-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Where should people go after clicking?</CardTitle>
              <CardDescription>Use a lead form for fast enquiries, or send traffic to your website.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border p-4 space-y-2">
                <p className="text-sm font-medium">Destination</p>
                <p className="text-xs text-muted-foreground">
                  {destinationType === 'meta_lead_form'
                    ? 'Meta / Facebook lead form (instant form inside Meta apps)'
                    : 'Website link'}
                </p>
                <Input
                  value={draft.destinationUrl}
                  onChange={(event) => onDraftChange({ destinationUrl: event.target.value })}
                  placeholder={defaultDestinationUrl || 'https://'}
                  disabled={destinationType === 'meta_lead_form'}
                />
                {destinationType === 'meta_lead_form' ? (
                  <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                    Meta lead form selection/creation will appear here once your Meta connection is configured.
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 7 ? (
          <Card className="border-0 shadow-sm ring-1 ring-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Preview your ad</CardTitle>
              <CardDescription>
                Switch placement + device to preview a single surface in detail. Next step shows all placements side-by-side.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-xl border bg-muted/20 p-4 text-sm">
                <p className="font-medium text-foreground">Campaign summary</p>
                <ul className="mt-2 grid gap-1 text-muted-foreground sm:grid-cols-2">
                  <li><span className="text-foreground">Goal:</span> {objective?.label ?? draft.goal}</li>
                  <li>
                    <span className="text-foreground">Budget:</span>{' '}
                    {budgetType === 'lifetime'
                      ? `$${lifetimeBudget || '—'} lifetime`
                      : `$${draft.dailyBudget}/day`}
                  </li>
                  <li>
                    <span className="text-foreground">Audience:</span> {draft.location || '—'} · {ageMin}–{ageMax} · {genders.length === 0 ? 'All' : genders.join(', ')}
                  </li>
                  <li><span className="text-foreground">Destination:</span> {destinationType === 'meta_lead_form' ? 'Meta lead form' : (draft.destinationUrl || '—')}</li>
                </ul>
              </div>

              {!selectedOption ? (
                <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  Pick an ad variant to see the preview.
                </div>
              ) : (
                <div className="space-y-4">
                  <PreviewPlacementSwitcher
                    placement={previewPlacement}
                    device={previewDevice}
                    onPlacementChange={setPreviewPlacement}
                    onDeviceChange={setPreviewDevice}
                  />
                  <div className="flex justify-center rounded-xl border bg-muted/10 p-6">
                    <FacebookAdPreview
                      data={{
                        pageName: businessName || 'Your Page',
                        pageAvatarUrl: facebookPageAvatarUrl,
                        primaryText: selectedOption.primaryText,
                        headline: selectedOption.headline,
                        description: selectedOption.description,
                        cta: selectedOption.cta,
                        mediaUrl: selectedOption.previewUrl,
                        mediaType: selectedOption.previewType,
                        destinationDomain,
                      }}
                      placement={previewPlacement}
                      device={previewDevice}
                      mediaLoading={generatingMediaIds?.includes(selectedOption.id) ?? false}
                    />
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">Summary:</span>{' '}
                      {objective?.label ?? draft.goal} · {draft.location || 'no location'} · {ageMin}-{ageMax} ·{' '}
                      {genders.length === 0 ? 'All genders' : genders.join(', ')} ·{' '}
                      {budgetType === 'lifetime'
                        ? `$${lifetimeBudget || '—'} lifetime`
                        : `$${draft.dailyBudget}/day`}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {step === 8 ? (
          <Card className="border-0 shadow-sm ring-1 ring-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Placements</CardTitle>
              <CardDescription>
                Pixel-honest previews for every Meta surface. Pick a placement and toggle mobile / desktop.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedOption ? (
                <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  Pick an ad variant first.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/10 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {AD_PLACEMENTS.map(({ id, label, icon }) => {
                        const active = previewPlacement === id
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setPreviewPlacement(id)}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                              active
                                ? 'border-[#1877F2] bg-[#1877F2] text-white shadow-sm'
                                : 'border-border bg-background text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {icon}
                            {label}
                          </button>
                        )
                      })}
                    </div>
                    <div className="inline-flex rounded-full border p-0.5">
                      {(['mobile', 'desktop'] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setPreviewDevice(value)}
                          className={cn(
                            'rounded-full px-3 py-1 text-[11px] font-medium capitalize transition-colors',
                            previewDevice === value
                              ? 'bg-[#1877F2] text-white'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-center overflow-x-auto rounded-xl bg-muted/20 px-4 py-6">
                    <FacebookAdPreview
                      data={{
                        pageName: businessName || 'Your Page',
                        pageAvatarUrl: facebookPageAvatarUrl,
                        primaryText: selectedOption.primaryText,
                        headline: selectedOption.headline,
                        description: selectedOption.description,
                        cta: selectedOption.cta,
                        mediaUrl: selectedOption.previewUrl,
                        mediaType: selectedOption.previewType,
                        destinationDomain,
                      }}
                      placement={previewPlacement}
                      device={previewDevice}
                      mediaLoading={generatingMediaIds?.includes(selectedOption.id) ?? false}
                    />
                  </div>

                  <p className="text-center text-[11px] text-muted-foreground">
                    Showing{' '}
                    <span className="font-medium text-foreground">
                      {AD_PLACEMENTS.find((p) => p.id === previewPlacement)?.label}
                    </span>{' '}
                    on {previewDevice === 'mobile' ? 'mobile' : 'desktop'}. Click any pill above to switch surface.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : null}

        {step === 9 ? (
          <Card className="border-0 shadow-sm ring-1 ring-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Publish to Meta Ads</CardTitle>
              <CardDescription>We’ll check your Meta connection before sending this campaign.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {metaReady ? (
                <div className="rounded-xl border bg-primary/5 p-4 text-sm">
                  <p className="font-medium">Meta connection looks good.</p>
                  <p className="text-muted-foreground">When ready, publish your ad campaign to Meta Ads.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
                  Before publishing, connect your Meta ad account and select a Facebook page in onboarding.
                </div>
              )}
              <Button
                className="w-full bg-[#1877F2] hover:bg-[#166fe0]"
                disabled={!selectedOption || !metaReady}
                onClick={() => void onPublish?.()}
              >
                Publish to Meta Ads
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                If something is missing (ad account, page, payment method), we’ll guide you to fix it.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={step === 1}
            onClick={() => setStep((s) => (Math.max(1, s - 1) as (typeof STUDIO_STEPS)[number]['id']))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>

          <div className="flex items-center gap-3">
            {nextReason && step < 9 ? (
              <p className="hidden text-xs text-muted-foreground sm:block">{nextReason}</p>
            ) : null}
            {step < 9 ? (
              <Button
                disabled={!canNext}
                onClick={() =>
                  setStep((s) => (Math.min(9, s + 1) as (typeof STUDIO_STEPS)[number]['id']))
                }
                className="bg-[#1877F2] hover:bg-[#166fe0]"
                title={nextReason || undefined}
              >
                Continue
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <Card className="border-[#1877F2]/20 bg-gradient-to-b from-[#1877F2]/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#1877F2]" />
              AI assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {aiTip ? (
              <p className="text-muted-foreground">{aiTip}</p>
            ) : (
              <p className="text-muted-foreground">
                Need help? Ask for better headlines, a stronger CTA, a new hook, or a suggested audience.
              </p>
            )}
            <div className="rounded-xl border bg-background p-2">
              <Textarea
                value={assistantPrompt}
                onChange={(e) => setAssistantPrompt(e.target.value)}
                placeholder="Ask AI… e.g. “Make this ad more persuasive for busy parents”"
                rows={3}
                className="border-0 shadow-none focus-visible:ring-0"
              />
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setAssistantPrompt('')
                    void onGenerateOptions()
                  }}
                >
                  Ask AI assistant
                </Button>
              </div>
            </div>
            <Button size="sm" variant="outline" className="w-full" onClick={onEditProfile}>
              Edit AI profile
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={suggestingAudience}
              onClick={() => void onSuggestAudience()}
            >
              {suggestingAudience ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Refresh AI suggestions
            </Button>
          </CardContent>
        </Card>

        <AdsReachPanel inputs={reachInputs} />
      </aside>
      </div>
    </div>
  )
}

function PreviewPlacementSwitcher({
  placement,
  device,
  onPlacementChange,
  onDeviceChange,
}: {
  placement: AdPlacement
  device: AdDevice
  onPlacementChange: (next: AdPlacement) => void
  onDeviceChange: (next: AdDevice) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {AD_PLACEMENTS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onPlacementChange(id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
              placement === id ? 'border-[#1877F2] bg-[#1877F2]/10 text-[#1877F2]' : 'hover:bg-muted',
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
      <div className="inline-flex rounded-full border p-0.5">
        {(['mobile', 'desktop'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onDeviceChange(value)}
            className={cn(
              'rounded-full px-3 py-1 text-[11px] font-medium capitalize transition-colors',
              device === value ? 'bg-[#1877F2] text-white' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  )
}

function VariantSkeletonCard({
  label,
  mediaType,
}: {
  label: string
  mediaType: 'image' | 'video'
}) {
  return (
    <div
      className="alive-enter relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-dashed bg-muted/10 p-3"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="alive-shimmer pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1877F2]">{label}</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            Crafting {mediaType === 'video' ? 'video ad' : 'image ad'}…
          </span>
        </div>
        <div className="h-5 w-16 rounded-full bg-muted/60" />
      </div>

      <div className="relative space-y-2 rounded-xl border bg-background p-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-muted/70" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-2/3 rounded-full bg-muted/70" />
            <div className="h-2 w-1/3 rounded-full bg-muted/50" />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="h-2.5 w-11/12 rounded-full bg-muted/60" />
          <div className="h-2.5 w-9/12 rounded-full bg-muted/60" />
          <div className="h-2.5 w-7/12 rounded-full bg-muted/40" />
        </div>
        <div className="aspect-square w-full overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 via-sky-500/5 to-cyan-500/10">
          <div className="alive-shimmer h-full w-full" />
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="h-2.5 w-1/2 rounded-full bg-muted/60" />
          <div className="h-6 w-20 rounded-md bg-muted/60" />
        </div>
      </div>

      <div className="relative flex items-center gap-2">
        <div className="h-8 flex-1 rounded-md bg-muted/60" />
        <div className="h-8 w-10 rounded-md bg-muted/40" />
      </div>
    </div>
  )
}
