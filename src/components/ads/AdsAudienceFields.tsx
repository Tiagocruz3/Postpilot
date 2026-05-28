import { Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { AdsSelectField } from '@/components/ads/AdsSelectField'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AGE_RANGE_OPTIONS,
  formatInterestList,
  GENDER_OPTIONS,
  INTEREST_GROUPS,
  LOCATION_OPTIONS,
  parseInterestList,
} from '@/lib/ads-targeting-options'
import { cn } from '@/lib/utils'

export type AudienceProfileFields = {
  description: string
  locations: string
  ageRange: string
  gender: string
  interests: string
  painPoints: string
  desiredOutcome: string
}

type AdsAudienceFieldsProps = {
  value: AudienceProfileFields
  onChange: (next: AudienceProfileFields) => void
  onSuggestAi?: () => Promise<void>
  aiLoading?: boolean
  compact?: boolean
}

export function AdsAudienceFields({
  value,
  onChange,
  onSuggestAi,
  aiLoading = false,
  compact = false,
}: AdsAudienceFieldsProps) {
  const [customInterest, setCustomInterest] = useState('')
  const selectedInterests = parseInterestList(value.interests)

  const toggleInterest = (interest: string) => {
    const next = selectedInterests.includes(interest)
      ? selectedInterests.filter((item) => item !== interest)
      : [...selectedInterests, interest]
    onChange({ ...value, interests: formatInterestList(next) })
  }

  const addCustomInterest = () => {
    const trimmed = customInterest.trim()
    if (!trimmed || selectedInterests.includes(trimmed)) return
    onChange({ ...value, interests: formatInterestList([...selectedInterests, trimmed]) })
    setCustomInterest('')
  }

  return (
    <div className="space-y-4">
      <div className={cn('grid gap-3', compact ? 'md:grid-cols-2' : 'md:grid-cols-2')}>
        <div className="md:col-span-2 grid gap-1.5">
          <Label className="text-sm font-medium">
            Audience description <span className="text-destructive">*</span>
          </Label>
          <Textarea
            value={value.description}
            onChange={(event) => onChange({ ...value, description: event.target.value })}
            placeholder="e.g. Homeowners aged 30–55 interested in kitchen renovations within 25 km of Brisbane"
            rows={3}
            className="resize-none"
          />
        </div>

        <AdsSelectField
          label="Locations"
          required
          value={value.locations}
          onChange={(locations) => onChange({ ...value, locations })}
          options={LOCATION_OPTIONS}
          placeholder="Choose where to show ads"
        />
        <AdsSelectField
          label="Age"
          value={value.ageRange}
          onChange={(ageRange) => onChange({ ...value, ageRange })}
          options={AGE_RANGE_OPTIONS}
          placeholder="Select age range"
        />
        <AdsSelectField
          label="Gender"
          value={value.gender}
          onChange={(gender) => onChange({ ...value, gender })}
          options={GENDER_OPTIONS}
          placeholder="All genders"
        />
      </div>

      <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Detailed targeting · Interests</p>
            <p className="text-xs text-muted-foreground">Pick interests like Meta Ads Manager, or let AI suggest a set.</p>
          </div>
          {onSuggestAi ? (
            <Button type="button" size="sm" variant="outline" disabled={aiLoading} onClick={() => void onSuggestAi()}>
              {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Suggest with AI
            </Button>
          ) : null}
        </div>

        {INTEREST_GROUPS.map(({ group, options }) => (
          <div key={group}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group}</p>
            <div className="flex flex-wrap gap-2">
              {options.map((option) => {
                const active = selectedInterests.includes(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleInterest(option.value)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors',
                      active ? 'border-[#1877F2] bg-[#1877F2]/10 text-[#1877F2]' : 'hover:bg-accent'
                    )}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <input
            value={customInterest}
            onChange={(event) => setCustomInterest(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addCustomInterest()
              }
            }}
            placeholder="Add custom interest"
            className="h-9 min-w-[180px] flex-1 rounded-md border border-input bg-background px-3 text-sm"
          />
          <Button type="button" size="sm" variant="secondary" onClick={addCustomInterest}>
            Add
          </Button>
        </div>

        {selectedInterests.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Selected: {selectedInterests.join(' · ')}
          </p>
        ) : (
          <p className="text-xs text-amber-700 dark:text-amber-400">Select at least one interest for better reach estimates.</p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-sm font-medium">
            Pain points <span className="text-destructive">*</span>
          </Label>
          <Textarea
            value={value.painPoints}
            onChange={(event) => onChange({ ...value, painPoints: event.target.value })}
            placeholder="What frustrates them before they find you?"
            rows={2}
            className="resize-none"
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-sm font-medium">
            Desired outcome <span className="text-destructive">*</span>
          </Label>
          <Textarea
            value={value.desiredOutcome}
            onChange={(event) => onChange({ ...value, desiredOutcome: event.target.value })}
            placeholder="Book a consult, buy, sign up, message you…"
            rows={2}
            className="resize-none"
          />
        </div>
      </div>
    </div>
  )
}
