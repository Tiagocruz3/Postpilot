import {
  Activity,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Megaphone,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Wand2,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type AdsTargetingSuggestionField =
  | 'age'
  | 'gender'
  | 'locations'
  | 'interests'
  | 'behaviours'
  | 'audienceSize'
  | 'objective'
  | 'placements'
  | 'budget'

export type AdsTargetingSuggestion = {
  field: AdsTargetingSuggestionField
  title: string
  value: string
  reasoning: string
  /** Display-only - caller is responsible for applying the patch. */
  applied?: boolean
}

type AdsTargetingSuggestionsProps = {
  loading?: boolean
  suggestions: AdsTargetingSuggestion[]
  onApply: (suggestion: AdsTargetingSuggestion) => void
  onApplyAll: () => void
  onRefresh: () => void
  className?: string
}

const FIELD_META: Record<
  AdsTargetingSuggestionField,
  { icon: ReactNode; label: string }
> = {
  age: { icon: <Users className="h-4 w-4" />, label: 'Age range' },
  gender: { icon: <Users className="h-4 w-4" />, label: 'Gender' },
  locations: { icon: <MapPin className="h-4 w-4" />, label: 'Locations' },
  interests: { icon: <Target className="h-4 w-4" />, label: 'Interests' },
  behaviours: { icon: <Activity className="h-4 w-4" />, label: 'Behaviours' },
  audienceSize: { icon: <Users className="h-4 w-4" />, label: 'Audience size' },
  objective: { icon: <Megaphone className="h-4 w-4" />, label: 'Objective' },
  placements: { icon: <Calendar className="h-4 w-4" />, label: 'Placements' },
  budget: { icon: <Wallet className="h-4 w-4" />, label: 'Budget' },
}

export function AdsTargetingSuggestions({
  loading,
  suggestions,
  onApply,
  onApplyAll,
  onRefresh,
  className,
}: AdsTargetingSuggestionsProps) {
  const [index, setIndex] = useState(0)
  const hasSuggestions = suggestions.length > 0
  const safeIndex = hasSuggestions ? Math.min(index, suggestions.length - 1) : 0
  const current = hasSuggestions ? suggestions[safeIndex] : null

  useEffect(() => {
    setIndex((prev) => Math.min(prev, Math.max(0, suggestions.length - 1)))
  }, [suggestions.length])

  const goPrev = () => {
    if (!hasSuggestions) return
    setIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1))
  }

  const goNext = () => {
    if (!hasSuggestions) return
    setIndex((prev) => (prev >= suggestions.length - 1 ? 0 : prev + 1))
  }

  return (
    <Card className={cn('border-[#1877F2]/20 bg-gradient-to-br from-[#1877F2]/5 via-background to-cyan-500/5', className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 shrink-0 text-[#1877F2]" />
              AI Targeting Suggestions
            </CardTitle>
            <CardDescription className="mt-0.5 line-clamp-2 text-xs sm:line-clamp-none">
              Apply one at a time or all at once. Use the arrows to browse each recommendation.
            </CardDescription>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
              {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1.5 h-3.5 w-3.5" />}
              Refresh
            </Button>
            {hasSuggestions ? (
              <Button size="sm" onClick={onApplyAll} disabled={loading} className="bg-[#1877F2] hover:bg-[#166fe0]">
                <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
                Apply all
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !hasSuggestions ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            Analysing your business profile…
          </div>
        ) : null}

        {!loading && !hasSuggestions ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
            Click <strong>Refresh</strong> for AI-recommended targeting with reasoning for each field.
          </div>
        ) : null}

        {current ? (
          <div className="space-y-2">
            <div className="flex items-stretch gap-1.5 sm:gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-9 w-9 shrink-0 self-center rounded-full"
                onClick={goPrev}
                disabled={loading || suggestions.length <= 1}
                aria-label="Previous suggestion"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div
                className={cn(
                  'min-w-0 flex-1 rounded-xl border p-3 transition-colors',
                  current.applied ? 'border-emerald-500/30 bg-emerald-500/5' : 'bg-background',
                )}
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1877F2]/10 text-[#1877F2]">
                    {FIELD_META[current.field].icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {FIELD_META[current.field].label}
                      </p>
                      {current.applied ? (
                        <Badge
                          variant="secondary"
                          className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300"
                        >
                          <Check className="mr-0.5 h-3 w-3" />
                          Applied
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-medium leading-snug text-foreground">{current.value}</p>
                    <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {current.reasoning}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5">
                  <p className="text-[11px] text-muted-foreground">
                    {safeIndex + 1} of {suggestions.length}
                  </p>
                  <Button
                    size="sm"
                    variant={current.applied ? 'ghost' : 'outline'}
                    onClick={() => onApply(current)}
                    disabled={loading}
                    className={cn(!current.applied && 'border-[#1877F2]/30 text-[#1877F2] hover:bg-[#1877F2]/5')}
                  >
                    {current.applied ? 'Re-apply' : 'Apply'}
                  </Button>
                </div>
              </div>

              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-9 w-9 shrink-0 self-center rounded-full"
                onClick={goNext}
                disabled={loading || suggestions.length <= 1}
                aria-label="Next suggestion"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {suggestions.length > 1 ? (
              <div className="flex flex-wrap items-center justify-center gap-1.5 px-10">
                {suggestions.map((suggestion, i) => (
                  <button
                    key={suggestion.field}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      i === safeIndex ? 'w-5 bg-[#1877F2]' : 'w-1.5 bg-muted-foreground/25 hover:bg-muted-foreground/40',
                      suggestion.applied && i !== safeIndex && 'bg-emerald-500/40',
                    )}
                    aria-label={`Go to ${FIELD_META[suggestion.field].label}`}
                    aria-current={i === safeIndex ? 'step' : undefined}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
