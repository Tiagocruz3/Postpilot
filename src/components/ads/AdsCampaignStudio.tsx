import { ChevronLeft, ChevronRight, Loader2, Sparkles, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
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
  generatingCopy?: boolean
  suggestingAudience?: boolean
  aiTip?: string
}

const STUDIO_STEPS = [
  { id: 1, label: 'Campaign', meta: 'Objective & name' },
  { id: 2, label: 'Audience', meta: 'Location & targeting' },
  { id: 3, label: 'Ad', meta: 'Creative & copy' },
  { id: 4, label: 'Budget', meta: 'Spend & review' },
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
  generatingCopy = false,
  suggestingAudience = false,
  aiTip,
}: AdsCampaignStudioProps) {
  const [step, setStep] = useState(1)
  const selectedOption = options.find((option) => option.id === selectedId) ?? null

  const objective = useMemo(
    () => META_CAMPAIGN_OBJECTIVES.find((item) => item.value === draft.goal),
    [draft.goal]
  )

  const canNext =
    (step === 1 && draft.campaignName.trim() && draft.promoting.trim() && draft.goal) ||
    (step === 2 && draft.location && draft.audience) ||
    (step === 3 && selectedOption) ||
    step === 4

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr_280px]">
      <nav className="space-y-1 rounded-xl border bg-card p-2 lg:sticky lg:top-4 lg:self-start">
        <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ads Manager</p>
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
          <p className="text-xs text-muted-foreground">Account</p>
          <p className="text-sm font-medium truncate">{businessName || 'Your business'}</p>
        </div>
      </nav>

      <div className="min-w-0 space-y-4">
        {step === 1 ? (
          <Card className="border-0 shadow-sm ring-1 ring-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">New campaign</CardTitle>
              <CardDescription>Choose your objective — same idea as Meta Ads Manager.</CardDescription>
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
                <Label>What are you promoting?</Label>
                <Input
                  value={draft.promoting}
                  onChange={(event) => onDraftChange({ promoting: event.target.value })}
                  placeholder="Your main offer or service"
                />
              </div>
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
              <AdsSelectField
                label="Ad format"
                value={draft.adType}
                onChange={(adType) => onDraftChange({ adType })}
                options={META_AD_FORMATS}
              />
              {recommendedAdTypes.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-3 text-sm">
                  <span className="text-muted-foreground">Recommended:</span>
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

        {step === 2 ? (
          <Card className="border-0 shadow-sm ring-1 ring-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Ad set · Audience</CardTitle>
              <CardDescription>Define who should see this ad. Pick locations and interests from the lists below.</CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        ) : null}

        {step === 3 ? (
          <Card className="border-0 shadow-sm ring-1 ring-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Ad creative</CardTitle>
              <CardDescription>Generate copy, then add an image or video.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => void onGenerateOptions()} disabled={generatingCopy || !draft.promoting.trim()}>
                {generatingCopy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate 3 ad options with AI
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
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No ads yet — generate options to continue.</p>
              )}

              {selectedOption ? (
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
                      Polish copy
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void onGenerateCreative('image')}>
                      Generate image
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void onGenerateCreative('video')}>
                      Generate video
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
                      Preview appears after you generate media
                    </div>
                  )}
                </div>
              ) : null}

              <div className="rounded-xl border p-4 space-y-2">
                <p className="text-sm font-medium">Destination</p>
                <p className="text-xs text-muted-foreground">
                  {destinationType === 'meta_lead_form'
                    ? 'Meta Lead Form (from your profile)'
                    : 'Website URL'}
                </p>
                <Input
                  value={draft.destinationUrl}
                  onChange={(event) => onDraftChange({ destinationUrl: event.target.value })}
                  placeholder={defaultDestinationUrl || 'https://'}
                />
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 4 ? (
          <Card className="border-0 shadow-sm ring-1 ring-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Budget & review</CardTitle>
              <CardDescription>Set daily spend and placements, then review before launch.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <AdsSelectField
                  label="Daily budget"
                  value={draft.dailyBudget}
                  onChange={(dailyBudget) => onDraftChange({ dailyBudget })}
                  options={DAILY_BUDGET_OPTIONS}
                />
                <AdsSelectField
                  label="Placements"
                  value={draft.placements}
                  onChange={(placements) => onDraftChange({ placements })}
                  options={PLACEMENT_OPTIONS}
                />
              </div>
              <div className="rounded-xl bg-muted/40 p-4 text-sm space-y-2">
                <p className="font-medium">Campaign summary</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li><span className="text-foreground">Objective:</span> {objective?.label ?? draft.goal}</li>
                  <li><span className="text-foreground">Audience:</span> {draft.audience || audienceProfile.description || '—'}</li>
                  <li><span className="text-foreground">Location:</span> {draft.location || audienceProfile.locations || '—'}</li>
                  <li><span className="text-foreground">Age / gender:</span> {[audienceProfile.ageRange, audienceProfile.gender].filter(Boolean).join(' · ') || '—'}</li>
                  <li><span className="text-foreground">Budget:</span> ${draft.dailyBudget}/day</li>
                  <li><span className="text-foreground">Ad:</span> {selectedOption?.headline ?? 'Generate an ad in step 3'}</li>
                </ul>
              </div>
              <Button className="w-full bg-[#1877F2] hover:bg-[#166fe0]" disabled={!selectedOption}>
                Ready for Meta (connect account to publish)
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Publishing to Meta requires a connected ad account. Use Connect Meta Ads above if needed.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex justify-between gap-2">
          <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          {step < 4 ? (
            <Button
              disabled={!canNext}
              onClick={() => setStep((s) => Math.min(4, s + 1))}
              className="bg-[#1877F2] hover:bg-[#166fe0]"
            >
              Continue
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : null}
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
                Complete your business profile for sharper targeting. On Audience, use <strong>Suggest with AI</strong> to fill locations and interests.
              </p>
            )}
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
