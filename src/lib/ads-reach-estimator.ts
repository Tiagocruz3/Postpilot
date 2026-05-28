/**
 * Client-side estimated reach calculator. Produces a deterministic range based on the
 * user's selected budget, location, age range, gender, interests, objective, placement
 * and ad format. Not live Meta data — designed to feel realistic and to react sensibly
 * to every meaningful change in targeting.
 */

export type ReachEstimateInputs = {
  /** Daily budget in account currency (USD). Used when budgetType === 'daily'. */
  dailyBudget?: number
  /** Lifetime budget in account currency (USD). Used when budgetType === 'lifetime'. */
  lifetimeBudget?: number
  /** Either 'daily' or 'lifetime'. Defaults to 'daily'. */
  budgetType?: 'daily' | 'lifetime'
  /** Campaign duration in days. Defaults to 7. */
  durationDays?: number
  /** Free-form location label or LOCATION_OPTIONS value. */
  location?: string | null
  /** Lower bound age (inclusive). */
  ageMin?: number
  /** Upper bound age (inclusive). */
  ageMax?: number
  /** Selected genders. Empty array = all genders. */
  genders?: string[]
  /** Selected interests. More interests = narrower reach. */
  interests?: string[]
  /** Selected behaviours. */
  behaviours?: string[]
  /** Campaign objective (META_CAMPAIGN_OBJECTIVES value). */
  objective?: string | null
  /** Placement preset (PLACEMENT_OPTIONS value). */
  placements?: string | null
  /** Ad format (META_AD_FORMATS value). */
  adFormat?: string | null
  /** Audience size preset, when the user picks one manually. */
  audienceSize?: 'narrow' | 'balanced' | 'broad'
}

export type ReachEstimate = {
  /** Lower bound of estimated reach (people). */
  min: number
  /** Upper bound of estimated reach (people). */
  max: number
  /** Human-readable formatted range, e.g. "18K – 62K". */
  label: string
  /** Indicative population pool the estimate was drawn from. */
  audiencePool: number
  /** Notes about the assumptions used, for tooltips. */
  notes: string[]
}

/**
 * Approximate addressable Meta audience by location key. Used purely as a starting
 * pool — the estimator scales it down based on targeting.
 */
const LOCATION_POOL: Record<string, number> = {
  worldwide: 2_900_000_000,
  'united states': 240_000_000,
  'united kingdom': 56_000_000,
  canada: 33_000_000,
  australia: 21_000_000,
  'new zealand': 4_300_000,
  singapore: 5_600_000,
  'australia — queensland': 4_700_000,
  'australia — brisbane': 2_300_000,
  'australia — gold coast': 720_000,
  'australia — sydney': 4_900_000,
  'australia — melbourne': 4_600_000,
  'worldwide — english speakers': 980_000_000,
}

const DEFAULT_POOL = 8_000_000

function poolForLocation(location?: string | null): number {
  if (!location) return DEFAULT_POOL
  const key = location.trim().toLowerCase()
  if (LOCATION_POOL[key] != null) return LOCATION_POOL[key]
  for (const [pattern, pool] of Object.entries(LOCATION_POOL)) {
    if (key.includes(pattern)) return pool
  }
  // City-style fallback (assume ~1.5M reachable adults)
  if (/—|,/.test(location)) return 1_500_000
  // Country-style fallback
  return 12_000_000
}

function ageBreadthFactor(ageMin?: number, ageMax?: number): number {
  if (!ageMin || !ageMax || ageMax <= ageMin) return 0.55
  const breadth = Math.min(60, Math.max(2, ageMax - ageMin))
  // 2y -> 0.08, 10y -> 0.32, 20y -> 0.55, 40y -> 0.9, 60y -> 1.0
  return Math.min(1, 0.06 + 0.018 * breadth)
}

function genderFactor(genders?: string[]): number {
  if (!genders || genders.length === 0) return 1
  const set = new Set(genders.map((g) => g.toLowerCase()))
  if (set.has('all')) return 1
  const includesWomen = set.has('women') || set.has('female') || set.has('all')
  const includesMen = set.has('men') || set.has('male') || set.has('all')
  if (includesWomen && includesMen) return 1
  if (includesWomen || includesMen) return 0.52
  return 1
}

function interestFactor(interests?: string[], behaviours?: string[]): number {
  const totalNarrowing = (interests?.length ?? 0) + (behaviours?.length ?? 0)
  if (totalNarrowing === 0) return 1
  // 1 interest: 0.55, 2: 0.4, 3: 0.3, 4: 0.24, 5+: 0.2
  const factors = [0.55, 0.4, 0.3, 0.24, 0.2]
  return factors[Math.min(totalNarrowing, factors.length) - 1]
}

function objectiveFactor(objective?: string | null): number {
  switch ((objective ?? '').toLowerCase()) {
    case 'build awareness':
    case 'reach':
      return 1.1
    case 'boost engagement':
    case 'get messages':
      return 0.92
    case 'send traffic to website':
      return 0.85
    case 'get leads':
      return 0.72
    case 'increase sales':
      return 0.65
    default:
      return 0.9
  }
}

function placementFactor(placement?: string | null): number {
  switch ((placement ?? '').toLowerCase()) {
    case 'advantage':
    case 'advantage+':
      return 1
    case 'feed_stories':
      return 0.86
    case 'feed':
      return 0.7
    case 'stories':
      return 0.55
    default:
      return 0.9
  }
}

function adFormatFactor(format?: string | null): number {
  switch ((format ?? '').toLowerCase()) {
    case 'single image ad':
      return 1
    case 'carousel ad':
      return 0.95
    case 'video ad':
      return 0.9
    case 'story / reel ad':
      return 0.7
    case 'lead form ad':
      return 0.78
    case 'website conversion ad':
      return 0.82
    case 'engagement ad':
      return 0.95
    default:
      return 0.95
  }
}

function audienceSizeFactor(size?: 'narrow' | 'balanced' | 'broad'): number {
  switch (size) {
    case 'narrow':
      return 0.55
    case 'broad':
      return 1.25
    case 'balanced':
    default:
      return 1
  }
}

/**
 * Approximate CPM in USD per impression depending on objective. Used to convert
 * budget into expected impressions, then into unique reach.
 */
function cpmForObjective(objective?: string | null): number {
  switch ((objective ?? '').toLowerCase()) {
    case 'build awareness':
      return 6
    case 'boost engagement':
    case 'get messages':
      return 8.5
    case 'send traffic to website':
      return 10
    case 'get leads':
      return 14
    case 'increase sales':
      return 18
    default:
      return 10
  }
}

/** Average impressions a single person sees in a campaign. */
const AVERAGE_FREQUENCY = 1.7

export function estimateReach(inputs: ReachEstimateInputs): ReachEstimate {
  const {
    budgetType = 'daily',
    dailyBudget,
    lifetimeBudget,
    durationDays = 7,
    location,
    ageMin,
    ageMax,
    genders,
    interests,
    behaviours,
    objective,
    placements,
    adFormat,
    audienceSize,
  } = inputs

  const safeDuration = Math.max(1, Math.min(60, durationDays))
  const totalBudget =
    budgetType === 'lifetime'
      ? Number(lifetimeBudget ?? 0)
      : Number(dailyBudget ?? 0) * safeDuration

  const audiencePool = Math.round(
    poolForLocation(location) *
      ageBreadthFactor(ageMin, ageMax) *
      genderFactor(genders) *
      interestFactor(interests, behaviours) *
      audienceSizeFactor(audienceSize),
  )

  const cpm = cpmForObjective(objective) * (1 / placementFactor(placements)) * (1 / adFormatFactor(adFormat))
  const expectedImpressions = (totalBudget * 1000) / Math.max(1, cpm)
  const uniqueReachCenter = Math.max(0, expectedImpressions / AVERAGE_FREQUENCY)

  // Cap reach by available audience pool — most campaigns never exhaust a pool, but
  // we keep this honest for tiny audiences and huge budgets.
  const cappedCenter = Math.min(uniqueReachCenter, audiencePool * 0.7)

  // ±35% spread around the center to express uncertainty.
  let min = Math.round(cappedCenter * 0.65)
  let max = Math.round(cappedCenter * 1.35)

  // Floor + cap so we never show "0" when there's budget, and never show absurd numbers.
  if (totalBudget > 0) min = Math.max(min, 200)
  max = Math.max(max, min + 100)

  if (totalBudget <= 0) {
    min = 0
    max = 0
  }

  const notes: string[] = []
  if (audiencePool > 0 && cappedCenter >= audiencePool * 0.65) {
    notes.push('Budget likely exceeds what this audience can absorb. Consider broadening targeting.')
  }
  if (totalBudget > 0 && totalBudget < 35 * safeDuration && objective === 'Increase sales') {
    notes.push('Sales campaigns usually need higher budgets to find purchasers.')
  }
  if ((interests?.length ?? 0) + (behaviours?.length ?? 0) >= 4) {
    notes.push('Multiple interests narrow your audience — try removing one to widen reach.')
  }

  return {
    min,
    max,
    label: formatReachRange(min, max),
    audiencePool,
    notes,
  }
}

export function formatReachRange(min: number, max: number): string {
  if (max <= 0) return '—'
  return `${formatAbbrev(min)} – ${formatAbbrev(max)}`
}

export function formatAbbrev(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`
  }
  return String(value)
}
