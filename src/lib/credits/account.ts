import {
  CREDIT_COSTS,
  EMPTY_CREDIT_MESSAGE,
  LOW_CREDIT_MESSAGE,
  MEMBERSHIP_PLANS,
  PLATFORM_ADMIN_EMAIL,
  type CreditActionType,
  type CreditHealth,
  type MembershipPlanId,
} from '@/lib/credits/constants'

export type UserCreditAccountRow = {
  user_id: string
  membership_plan: MembershipPlanId
  monthly_credits_used: number
  topup_credits_balance: number
  cycle_start: string
  cycle_end: string
  posts_used: number
  images_used: number
  videos_used: number
}

export type CreditBalanceView = {
  isAdmin: boolean
  planId: MembershipPlanId
  planName: string
  monthlyAllowance: number
  monthlyUsed: number
  monthlyRemaining: number
  topupBalance: number
  totalRemaining: number
  percentRemaining: number
  health: CreditHealth
  cycleEnd: Date
  daysUntilReset: number
  statusMessage: string | null
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === PLATFORM_ADMIN_EMAIL.toLowerCase()
}

export function buildCreditBalance(
  account: UserCreditAccountRow | null,
  isAdmin: boolean,
  planId: MembershipPlanId = 'free',
): CreditBalanceView {
  if (isAdmin) {
    return {
      isAdmin: true,
      planId,
      planName: 'Admin',
      monthlyAllowance: Infinity,
      monthlyUsed: 0,
      monthlyRemaining: Infinity,
      topupBalance: 0,
      totalRemaining: Infinity,
      percentRemaining: 100,
      health: 'unlimited',
      cycleEnd: new Date(),
      daysUntilReset: 0,
      statusMessage: null,
    }
  }

  const plan = MEMBERSHIP_PLANS[planId]
  const monthlyAllowance = plan.monthlyCredits
  const monthlyUsed = account?.monthly_credits_used ?? 0
  const topupBalance = account?.topup_credits_balance ?? 0
  const monthlyRemaining = Math.max(0, monthlyAllowance - monthlyUsed)
  const totalRemaining = monthlyRemaining + topupBalance
  const percentRemaining =
    monthlyAllowance > 0 ? Math.round((totalRemaining / monthlyAllowance) * 100) : 0

  let health: CreditHealth = 'healthy'
  if (totalRemaining <= 0) health = 'empty'
  else if (percentRemaining < 10) health = 'critical'
  else if (percentRemaining < 25) health = 'low'

  const cycleEnd = account?.cycle_end ? new Date(account.cycle_end) : endOfMonth(new Date())
  const daysUntilReset = Math.max(0, Math.ceil((cycleEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

  let statusMessage: string | null = null
  if (health === 'empty') statusMessage = EMPTY_CREDIT_MESSAGE
  else if (health === 'low' || health === 'critical') statusMessage = LOW_CREDIT_MESSAGE

  return {
    isAdmin: false,
    planId,
    planName: plan.name,
    monthlyAllowance,
    monthlyUsed,
    monthlyRemaining,
    topupBalance,
    totalRemaining,
    percentRemaining: Math.min(100, percentRemaining),
    health,
    cycleEnd,
    daysUntilReset,
    statusMessage,
  }
}

export function getCreditCost(action: CreditActionType): number {
  return CREDIT_COSTS[action]
}

export function canAfford(balance: CreditBalanceView, action: CreditActionType): boolean {
  if (balance.isAdmin) return true
  return balance.totalRemaining >= getCreditCost(action)
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59)
}

export function formatCredits(value: number): string {
  if (!Number.isFinite(value)) return 'Unlimited'
  return value.toLocaleString()
}
