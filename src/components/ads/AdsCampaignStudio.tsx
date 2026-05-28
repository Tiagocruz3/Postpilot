import { ChevronLeft, ChevronRight, Loader2, Sparkles, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AdsAudienceFields, type AudienceProfileFields } from '@/components/ads/AdsAudienceFields'
import { AdsSelectField } from '@/components/ads/AdsSelectField'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
}

type AdOption = {
  id: string
  name: string
  primaryText: string
  headline: string
  cta: string
  previewUrl: string | null
  previewType: 'image' | 'video'
}

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
  options: AdOption[]
  selectedId: string | null
  onSelectOption: (id: string) => void
  onUpdateOption: (id: string, patch: Partial<AdOption>) => void
  onGenerateOptions: () => Promise<void>
  onGenerateCreative: (type: 'image' | 'video') => Promise<void>
  onSuggestAudience: () => Promise<void>
  onEditProfile: () => void
  metaReady?: boolean
  onPublish?: () => Promise<void> | void
  generatingCopy?: boolean
  suggestingAudience?: boolean
  aiTip?: string
}

const STUDIO_STEPS = [
  { id: 1, label: 'Goal', meta: 'What you want to achieve' },
  { id: 2, label: 'Offer', meta: 'What you are promoting' },
  { id: 3, label: 'Generate', meta: 'Create 3 ad options' },
  { id: 4, label: 'Edit', meta: 'Copy + creative' },
  { id: 5, label: 'Audience & budget', meta: 'Who + how much' },
  { id: 6, label: 'Lead destination', meta: 'Form or website link' },
  { id: 7, label: 'Preview', meta: 'Review before publish' },
  { id: 8, label: 'Publish', meta: 'Send to Meta Ads' },
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
  options,
  selectedId,
  onSelectOption,
  onUpdateOption,
  onGenerateOptions,
  onGenerateCreative,
  onSuggestAudience,
  onEditProfile,
  metaReady = false,
  onPublish,
  generatingCopy = false,
  suggestingAudience = false,
  aiTip,
}: AdsCampaignStudioProps) {
  const [step, setStep] = useState<(typeof STUDIO_STEPS)[number]['id']>(1)
  const [assistantPrompt, setAssistantPrompt] = useState('')
  const selectedOption = options.find((option) => option.id === selectedId) ?? null

  const objective = useMemo(
    () => META_CAMPAIGN_OBJECTIVES.find((item) => item.value === draft.goal),
    [draft.goal]
  )

  // Auto-advance from "Generate" to "Edit" the first time options appear (after AI generation),
  // so users don't have to click Continue separately.
  const prevOptionsCount = useRef(options.length)
  useEffect(() => {
    const prev = prevOptionsCount.current
    prevOptionsCount.current = options.length
    if (step === 3 && prev === 0 && options.length > 0) {
      setStep(4)
    }
  }, [options.length, step])

  const nextReason = (() => {
    if (step === 1 && !draft.goal) return 'Choose a goal first.'
    if (step === 2 && !draft.promoting.trim()) return 'Tell us what you’re promoting.'
    if (step === 3 && options.length === 0) return 'Click “Generate ads” to create 3 options.'
    if (step === 4 && !selectedOption) return 'Pick an ad option from the previous step.'
    if (step === 5 && (!draft.location || !draft.dailyBudget)) return 'Add a location and daily budget.'
    if (step === 6 && destinationType !== 'meta_lead_form' && !draft.destinationUrl.trim()) {
      return 'Add a destination URL or use a Meta lead form.'
    }
    return ''
  })()
  const canNext = !nextReason

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr_280px]">
      <nav className="space-y-1 rounded-xl border bg-card p-2 lg:sticky lg:top-4 lg:self-start">
        <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ad Studio</p>
        {STUDIO_STEPS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setStep(item.id)}
            className={cn(
              'flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm transition-colors',
              step === item.id ? 'bg-[#1877F2]/10 text-[#1877F2]' : 'hover:bg-muted'
            )}
          >
            <span className="font-medium">{item.label}</span>
            <span className="text-xs text-muted-foreground">{item.meta}</span>
          </button>
        ))}
        <div className="mt-3 border-t pt-3 px-2">
          <p className="text-xs text-muted-foreground">Business</p>
          <p className="text-sm font-medium truncate">{businessName || 'Your business'}</p>
        </div>
      </nav>

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
          <Card className="border-0 shadow-sm ring-1 ring-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Generate 3 ad options with AI</CardTitle>
              <CardDescription>We’ll create 3 angles: direct offer, problem/solution, and social proof.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => void onGenerateOptions()} disabled={generatingCopy || !draft.promoting.trim()}>
                {generatingCopy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate ads
              </Button>

              {options.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onSelectOption(option.id)}
                      className={cn(
                        'rounded-xl border p-3 text-left transition-all',
                        selectedId === option.id ? 'border-[#1877F2] ring-2 ring-[#1877F2]/20' : 'hover:bg-muted/50'
                      )}
                    >
                      <p className="text-xs font-medium text-[#1877F2]">{option.name}</p>
                      <p className="mt-1 text-sm font-semibold line-clamp-2">{option.headline}</p>
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{option.primaryText}</p>
                      <Badge className="mt-2" variant="secondary">{option.cta}</Badge>
                      <p className="mt-2 text-xs font-medium text-foreground">Use this ad →</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No ads yet — generate options to continue.</p>
              )}
              <div className="rounded-xl border bg-muted/20 p-4 text-sm">
                <p className="font-medium">Tip</p>
                <p className="text-muted-foreground">
                  If your offer is unclear, go back and make your “Product / service” more specific (price, outcome, or timeframe).
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 4 ? (
          <Card className="border-0 shadow-sm ring-1 ring-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Edit your ad</CardTitle>
              <CardDescription>Rewrite the copy, then generate or replace the creative.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedOption ? (
                <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                  Select an ad option in the previous step.
                </div>
              ) : (
                <>
                  <div className="space-y-3 rounded-xl border p-4">
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
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onUpdateOption(selectedOption.id, {
                            primaryText: `${selectedOption.primaryText}\n\n${brandTone} tone · CTA: ${brandCta}.`,
                          })
                        }
                      >
                        <Wand2 className="mr-2 h-4 w-4" />
                        Rewrite copy
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void onGenerateCreative('image')}>
                        Regenerate image
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void onGenerateCreative('video')}>
                        Regenerate video
                      </Button>
                    </div>
                    {selectedOption.previewUrl ? (
                      selectedOption.previewType === 'video' ? (
                        <video src={selectedOption.previewUrl} controls className="aspect-[4/5] max-h-72 w-full rounded-lg object-cover bg-muted" />
                      ) : (
                        <img src={selectedOption.previewUrl} alt="" className="aspect-[4/5] max-h-72 w-full rounded-lg object-cover bg-muted" />
                      )
                    ) : (
                      <div className="flex aspect-[4/5] max-h-72 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                        Generate an image or video to preview
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ) : null}

        {step === 5 ? (
          <Card className="border-0 shadow-sm ring-1 ring-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Who should see this ad?</CardTitle>
              <CardDescription>Keep it simple. Start broad, then narrow based on results.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <AdsSelectField
                  label="Daily budget"
                  value={draft.dailyBudget}
                  onChange={(dailyBudget) => onDraftChange({ dailyBudget })}
                  options={DAILY_BUDGET_OPTIONS}
                />
                <AdsSelectField
                  label="Placements (recommended)"
                  value={draft.placements}
                  onChange={(placements) => onDraftChange({ placements })}
                  options={PLACEMENT_OPTIONS}
                />
              </div>
              <div className="rounded-xl border bg-primary/5 p-4 text-sm">
                <p className="font-medium">AI recommendation</p>
                <p className="text-muted-foreground">
                  Start with <strong>${draft.dailyBudget || 20}/day</strong> for <strong>7 days</strong> to find the best-performing angle.
                </p>
              </div>
            </CardContent>
          </Card>
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
              <CardTitle className="text-lg">Preview</CardTitle>
              <CardDescription>Review everything before publishing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border p-4 space-y-2 text-sm">
                  <p className="font-medium">Campaign summary</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li><span className="text-foreground">Goal:</span> {objective?.label ?? draft.goal}</li>
                    <li><span className="text-foreground">Budget:</span> ${draft.dailyBudget}/day</li>
                    <li><span className="text-foreground">Audience:</span> {draft.location || '—'} · {audienceProfile.ageRange || '—'} · {audienceProfile.gender || '—'}</li>
                    <li><span className="text-foreground">Destination:</span> {destinationType === 'meta_lead_form' ? 'Meta lead form' : (draft.destinationUrl || '—')}</li>
                  </ul>
                </div>
                <div className="rounded-xl border p-4 space-y-2 text-sm">
                  <p className="font-medium">Ad preview</p>
                  <p className="text-muted-foreground">{selectedOption?.primaryText || 'Select an ad option.'}</p>
                  <p className="font-semibold">{selectedOption?.headline || '—'}</p>
                  <Badge variant="secondary">{selectedOption?.cta || brandCta}</Badge>
                </div>
              </div>
              {selectedOption?.previewUrl ? (
                selectedOption.previewType === 'video' ? (
                  <video src={selectedOption.previewUrl} controls className="aspect-[4/5] max-h-80 w-full rounded-xl object-cover bg-muted" />
                ) : (
                  <img src={selectedOption.previewUrl} alt="" className="aspect-[4/5] max-h-80 w-full rounded-xl object-cover bg-muted" />
                )
              ) : (
                <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                  Add an image or video to preview your ad.
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {step === 8 ? (
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
            {nextReason && step < 8 ? (
              <p className="hidden text-xs text-muted-foreground sm:block">{nextReason}</p>
            ) : null}
            {step < 8 ? (
              <Button
                disabled={!canNext}
                onClick={() =>
                  setStep((s) => (Math.min(8, s + 1) as (typeof STUDIO_STEPS)[number]['id']))
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Estimated reach</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p className="text-2xl font-semibold text-foreground">
              {draft.location ? '12K – 48K' : '—'}
            </p>
            <p className="mt-1 text-xs">Indicative range based on location and interests (not live Meta data).</p>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
