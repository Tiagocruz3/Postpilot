import {
  Activity,
  Calendar,
  Check,
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
import type { ReactNode } from 'react'
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
  /** Display-only — caller is responsible for applying the patch. */
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
  const hasSuggestions = suggestions.length > 0

  return (
    <Card className={cn('border-[#1877F2]/20 bg-gradient-to-br from-[#1877F2]/5 via-background to-cyan-500/5', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-[#1877F2]" />
              AI Targeting Suggestions
            </CardTitle>
            <CardDescription className="mt-1">
              Smart recommendations based on your business, offer, and campaign objective. Apply any, edit them
              manually, or refresh to try again.
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
      <CardContent className="space-y-2">
        {loading && !hasSuggestions ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analysing your business profile to suggest targeting…
          </div>
        ) : null}

        {!loading && !hasSuggestions ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
            Click <strong>Refresh</strong> to get AI-recommended age range, locations, interests, audience size,
            placements, and budget — with reasoning for each.
          </div>
        ) : null}

        {suggestions.map((suggestion) => {
          const meta = FIELD_META[suggestion.field]
          return (
            <div
              key={suggestion.field}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-3 transition-colors',
                suggestion.applied ? 'border-emerald-500/30 bg-emerald-500/5' : 'bg-background',
              )}
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1877F2]/10 text-[#1877F2]">
                {meta.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{meta.label}</p>
                  {suggestion.applied ? (
                    <Badge variant="secondary" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      <Check className="mr-1 h-3 w-3" />
                      Applied
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-medium text-foreground">{suggestion.value}</p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{suggestion.reasoning}</p>
              </div>
              <Button
                size="sm"
                variant={suggestion.applied ? 'ghost' : 'outline'}
                onClick={() => onApply(suggestion)}
                disabled={loading}
              >
                {suggestion.applied ? 'Re-apply' : 'Apply'}
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
