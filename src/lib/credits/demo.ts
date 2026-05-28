import type { MembershipPlanId } from '@/lib/credits/constants'
import type { UserCreditAccountRow } from '@/lib/credits/account'

const DEMO_KEY = 'adguru_demo_credits'

type DemoCreditState = {
  membership_plan: MembershipPlanId
  monthly_credits_used: number
  topup_credits_balance: number
  cycle_end: string
}

function load(): DemoCreditState {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    if (raw) return JSON.parse(raw) as DemoCreditState
  } catch {
    // ignore
  }
  return {
    membership_plan: 'pro',
    monthly_credits_used: 680,
    topup_credits_balance: 200,
    cycle_end: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
  }
}

function save(state: DemoCreditState) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(state))
}

export function getDemoCreditAccount(userId: string, isAdmin: boolean): UserCreditAccountRow {
  const state = load()
  if (isAdmin) {
    return {
      user_id: userId,
      membership_plan: 'agency',
      monthly_credits_used: 0,
      topup_credits_balance: 0,
      cycle_start: new Date().toISOString(),
      cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      posts_used: 0,
      images_used: 0,
      videos_used: 0,
    }
  }
  return {
    user_id: userId,
    membership_plan: state.membership_plan,
    monthly_credits_used: state.monthly_credits_used,
    topup_credits_balance: state.topup_credits_balance,
    cycle_start: new Date().toISOString(),
    cycle_end: state.cycle_end,
    posts_used: 0,
    images_used: 0,
    videos_used: 0,
  }
}

export function consumeDemoCredits(credits: number): UserCreditAccountRow {
  const state = load()
  const allowance =
    state.membership_plan === 'pro'
      ? 2500
      : state.membership_plan === 'starter'
        ? 750
        : 50
  const monthlyRemaining = Math.max(0, allowance - state.monthly_credits_used)
  let fromMonthly = Math.min(credits, monthlyRemaining)
  let fromTopup = credits - fromMonthly
  state.monthly_credits_used += fromMonthly
  state.topup_credits_balance = Math.max(0, state.topup_credits_balance - fromTopup)
  save(state)
  return getDemoCreditAccount('demo-user-id', false)
}

export function addDemoTopup(credits: number) {
  const state = load()
  state.topup_credits_balance += credits
  save(state)
}
