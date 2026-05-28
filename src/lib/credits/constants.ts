export const PLATFORM_ADMIN_EMAIL = 'tiagocruz3@gmail.com'

export type MembershipPlanId = 'free' | 'starter' | 'pro' | 'growth' | 'agency'

export type CreditActionType =
  | 'caption'
  | 'hashtags'
  | 'post_idea'
  | 'ad_copy'
  | 'image'
  | 'video_short'
  | 'video_premium'
  | 'research'
  | 'remix'
  | 'audience_suggest'

export type CreditHealth = 'healthy' | 'low' | 'critical' | 'empty' | 'unlimited'

export const CREDIT_COSTS: Record<CreditActionType, number> = {
  caption: 1,
  hashtags: 1,
  post_idea: 1,
  ad_copy: 2,
  image: 10,
  video_short: 75,
  video_premium: 200,
  research: 1,
  remix: 1,
  audience_suggest: 1,
}

export const MEMBERSHIP_PLANS: Record<
  MembershipPlanId,
  {
    id: MembershipPlanId
    name: string
    priceMonthly: number
    monthlyCredits: number
    postsPerMonth: number
    imagesPerMonth: number
    videosPerMonth: number
    socialAccounts: number
  }
> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    monthlyCredits: 50,
    postsPerMonth: 10,
    imagesPerMonth: 5,
    videosPerMonth: 0,
    socialAccounts: 1,
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 19,
    monthlyCredits: 750,
    postsPerMonth: 60,
    imagesPerMonth: 40,
    videosPerMonth: 4,
    socialAccounts: 2,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 49,
    monthlyCredits: 2500,
    postsPerMonth: 200,
    imagesPerMonth: 150,
    videosPerMonth: 12,
    socialAccounts: 5,
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    priceMonthly: 99,
    monthlyCredits: 7500,
    postsPerMonth: 500,
    imagesPerMonth: 400,
    videosPerMonth: 30,
    socialAccounts: 10,
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    priceMonthly: 500,
    monthlyCredits: 25000,
    postsPerMonth: 1500,
    imagesPerMonth: 1200,
    videosPerMonth: 100,
    socialAccounts: 30,
  },
}

export const TOP_UP_PACKS = [
  { id: 'small', name: 'Small Top Up', credits: 1000, price: 10, bestValue: false },
  { id: 'creator', name: 'Creator Boost', credits: 5000, price: 39, bestValue: true },
  { id: 'growth', name: 'Growth Pack', credits: 10000, price: 69, bestValue: false },
  { id: 'power', name: 'Power Pack', credits: 25000, price: 149, bestValue: false },
] as const

export const LOW_CREDIT_MESSAGE =
  "You're running low on AI credits. Top up now to keep creating without interruption."

export const EMPTY_CREDIT_MESSAGE =
  "You're out of AI credits. Top up your credits or upgrade your plan to keep generating AI content."

export const ACTION_LABELS: Record<CreditActionType, string> = {
  caption: 'Generate caption',
  hashtags: 'Generate hashtags',
  post_idea: 'Generate post idea',
  ad_copy: 'Generate ad copy',
  image: 'Generate image',
  video_short: 'Generate short video',
  video_premium: 'Generate premium video',
  research: 'Research post',
  remix: 'Remix post',
  audience_suggest: 'Suggest audience',
}

export const PLAN_ORDER: Record<MembershipPlanId, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  growth: 3,
  agency: 4,
}

/**
 * Minimum membership plan required to perform each action. Used to gate features
 * before consuming credits (e.g. AI Video is not available on the Free plan).
 */
export const MIN_PLAN_FOR_ACTION: Record<CreditActionType, MembershipPlanId> = {
  caption: 'free',
  hashtags: 'free',
  post_idea: 'free',
  ad_copy: 'free',
  image: 'free',
  research: 'free',
  remix: 'free',
  audience_suggest: 'free',
  video_short: 'starter',
  video_premium: 'pro',
}

export function getRequiredPlan(action: CreditActionType): MembershipPlanId {
  return MIN_PLAN_FOR_ACTION[action] ?? 'free'
}

export function meetsPlanRequirement(
  currentPlan: MembershipPlanId,
  action: CreditActionType,
): boolean {
  return PLAN_ORDER[currentPlan] >= PLAN_ORDER[getRequiredPlan(action)]
}

/** Map edge function names to credit actions. */
export function creditActionForFunction(functionName: string, body?: Record<string, unknown>): CreditActionType {
  switch (functionName) {
    case 'generate-compose-copy':
      return body?.mode === 'hashtags' ? 'hashtags' : body?.mode === 'idea' ? 'post_idea' : 'caption'
    case 'generate-ad-copy':
      return 'ad_copy'
    case 'generate-image':
      return 'image'
    case 'generate-video':
      return body?.premium === true ? 'video_premium' : 'video_short'
    case 'research-post':
      return 'research'
    case 'remix-post':
    case 'remix-inspiration':
      return 'remix'
    case 'suggest-ads-targeting':
      return 'audience_suggest'
    default:
      return 'caption'
  }
}
