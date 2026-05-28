import { isDemoMode } from '@/lib/demo'
import { supabase } from '@/lib/supabase'
import type {
  AdminSubscriptionConfig,
  AdminUserRow,
  AdminUsageLogRow,
  CreditRulesMap,
  SubscriptionPlanRow,
  SubscriptionSettingsMap,
  TopupPackRow,
} from '@/lib/admin/types'
import { CREDIT_COSTS, MEMBERSHIP_PLANS, TOP_UP_PACKS } from '@/lib/credits/constants'

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
}

const db = supabase as unknown as RpcClient

const DEMO_USERS_KEY = 'adguru_admin_users'
const DEMO_CONFIG_KEY = 'adguru_admin_config'

function defaultDemoUsers(): AdminUserRow[] {
  return [
    {
      user_id: 'demo-user-id',
      name: 'Demo User',
      email: 'demo@adguru.app',
      role: 'member',
      plan: 'pro',
      subscription_status: 'active',
      monthly_credits: 2500,
      topup_credits: 200,
      credits_used: 680,
      posts_used: 12,
      images_used: 8,
      videos_used: 2,
      joined_at: new Date().toISOString(),
      suspended_at: null,
    },
    {
      user_id: 'demo-user-2',
      name: 'Alex Rivera',
      email: 'alex@example.com',
      role: 'member',
      plan: 'starter',
      subscription_status: 'active',
      monthly_credits: 750,
      topup_credits: 0,
      credits_used: 420,
      posts_used: 20,
      images_used: 15,
      videos_used: 1,
      joined_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      suspended_at: null,
    },
  ]
}

function defaultDemoConfig(): AdminSubscriptionConfig {
  const plans: SubscriptionPlanRow[] = Object.values(MEMBERSHIP_PLANS).map((p, i) => ({
    id: p.id,
    name: p.name,
    monthly_price: p.priceMonthly,
    monthly_credits: p.monthlyCredits,
    posts_limit: p.postsPerMonth,
    images_limit: p.imagesPerMonth,
    videos_limit: p.videosPerMonth,
    social_accounts_limit: p.socialAccounts,
    team_members_limit: p.id === 'agency' ? 30 : 5,
    access_ads: p.id !== 'free',
    access_premium_video: ['pro', 'growth', 'agency'].includes(p.id),
    access_analytics: true,
    access_scheduling: true,
    access_ai_vault: true,
    status: 'active' as const,
    featured: p.id === 'pro',
    sort_order: i,
  }))
  const topups: TopupPackRow[] = TOP_UP_PACKS.map((t, i) => ({
    id: t.id,
    name: t.name,
    credits: t.credits,
    price: t.price,
    best_value: t.bestValue,
    active: true,
    sort_order: i,
  }))
  return {
    plans,
    topups,
    credit_rules: { ...CREDIT_COSTS },
    settings: {
      enableFreePlan: true,
      enableTrials: false,
      trialDays: 14,
      allowTopUp: true,
      allowUpgrade: true,
      allowDowngrade: true,
      allowCancel: true,
      lowCreditThresholdPercent: 25,
      criticalCreditThresholdPercent: 10,
      currency: 'USD',
      taxEnabled: false,
      taxRatePercent: 10,
      billingProvider: 'stripe',
    },
    audit_logs: [],
  }
}

function loadDemoUsers(): AdminUserRow[] {
  try {
    const raw = localStorage.getItem(DEMO_USERS_KEY)
    if (raw) return JSON.parse(raw) as AdminUserRow[]
  } catch {
    // ignore
  }
  return defaultDemoUsers()
}

function saveDemoUsers(users: AdminUserRow[]) {
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users))
}

function loadDemoConfig(): AdminSubscriptionConfig {
  try {
    const raw = localStorage.getItem(DEMO_CONFIG_KEY)
    if (raw) return JSON.parse(raw) as AdminSubscriptionConfig
  } catch {
    // ignore
  }
  return defaultDemoConfig()
}

function saveDemoConfig(config: AdminSubscriptionConfig) {
  localStorage.setItem(DEMO_CONFIG_KEY, JSON.stringify(config))
}

export async function adminListUsers(): Promise<AdminUserRow[]> {
  if (isDemoMode) return loadDemoUsers()
  const { data, error } = await db.rpc('admin_list_users')
  if (error) throw new Error(error.message)
  return (data as AdminUserRow[]) ?? []
}

export async function adminGetConfig(): Promise<AdminSubscriptionConfig> {
  if (isDemoMode) return loadDemoConfig()
  const { data, error } = await db.rpc('admin_get_subscription_config')
  if (error) throw new Error(error.message)
  return data as AdminSubscriptionConfig
}

export async function adminUpdateUser(params: {
  userId: string
  role?: 'admin' | 'member'
  plan?: string
  subscriptionStatus?: string
  suspend?: boolean
}) {
  if (isDemoMode) {
    const users = loadDemoUsers()
    const idx = users.findIndex((u) => u.user_id === params.userId)
    if (idx >= 0) {
      if (params.role) users[idx].role = params.role
      if (params.plan) users[idx].plan = params.plan
      if (params.subscriptionStatus) users[idx].subscription_status = params.subscriptionStatus
      if (params.suspend === true) users[idx].suspended_at = new Date().toISOString()
      if (params.suspend === false) users[idx].suspended_at = null
      saveDemoUsers(users)
    }
    return
  }
  const { error } = await db.rpc('admin_update_user', {
    p_user_id: params.userId,
    p_role: params.role ?? null,
    p_plan: params.plan ?? null,
    p_subscription_status: params.subscriptionStatus ?? null,
    p_suspend: params.suspend ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function adminAdjustCredits(params: {
  userId: string
  monthlyDelta?: number
  topupDelta?: number
  resetMonthlyUsed?: boolean
}) {
  if (isDemoMode) {
    const users = loadDemoUsers()
    const u = users.find((x) => x.user_id === params.userId)
    if (u) {
      if (params.resetMonthlyUsed) u.credits_used = 0
      else if (params.monthlyDelta) u.credits_used = Math.max(0, u.credits_used - params.monthlyDelta)
      if (params.topupDelta) u.topup_credits = Math.max(0, u.topup_credits + params.topupDelta)
      saveDemoUsers(users)
    }
    return
  }
  const { error } = await db.rpc('admin_adjust_credits', {
    p_user_id: params.userId,
    p_monthly_delta: params.monthlyDelta ?? 0,
    p_topup_delta: params.topupDelta ?? 0,
    p_reset_monthly_used: params.resetMonthlyUsed ?? false,
  })
  if (error) throw new Error(error.message)
}

export async function adminSavePlan(plan: SubscriptionPlanRow) {
  if (isDemoMode) {
    const config = loadDemoConfig()
    const idx = config.plans.findIndex((p) => p.id === plan.id)
    if (idx >= 0) config.plans[idx] = plan
    else config.plans.push(plan)
    saveDemoConfig(config)
    return
  }
  const { error } = await db.rpc('admin_save_plan', { p_plan: plan })
  if (error) throw new Error(error.message)
}

export async function adminDeletePlan(planId: string) {
  if (isDemoMode) {
    const config = loadDemoConfig()
    config.plans = config.plans.filter((p) => p.id !== planId)
    saveDemoConfig(config)
    return
  }
  const { error } = await db.rpc('admin_delete_plan', { p_plan_id: planId })
  if (error) throw new Error(error.message)
}

export async function adminSaveTopup(pack: TopupPackRow) {
  if (isDemoMode) {
    const config = loadDemoConfig()
    const idx = config.topups.findIndex((p) => p.id === pack.id)
    if (idx >= 0) config.topups[idx] = pack
    else config.topups.push(pack)
    saveDemoConfig(config)
    return
  }
  const { error } = await db.rpc('admin_save_topup', { p_pack: pack })
  if (error) throw new Error(error.message)
}

export async function adminDeleteTopup(packId: string) {
  if (isDemoMode) {
    const config = loadDemoConfig()
    config.topups = config.topups.filter((p) => p.id !== packId)
    saveDemoConfig(config)
    return
  }
  const { error } = await db.rpc('admin_delete_topup', { p_pack_id: packId })
  if (error) throw new Error(error.message)
}

export async function adminSaveCreditRules(rules: CreditRulesMap) {
  if (isDemoMode) {
    const config = loadDemoConfig()
    config.credit_rules = rules
    saveDemoConfig(config)
    return
  }
  const { error } = await db.rpc('admin_save_credit_rules', { p_rules: rules })
  if (error) throw new Error(error.message)
}

export async function adminSaveSubscriptionSettings(settings: SubscriptionSettingsMap) {
  if (isDemoMode) {
    const config = loadDemoConfig()
    config.settings = settings
    saveDemoConfig(config)
    return
  }
  const { error } = await db.rpc('admin_save_subscription_settings', { p_settings: settings })
  if (error) throw new Error(error.message)
}

export async function adminListUsageLogs(limit = 200): Promise<AdminUsageLogRow[]> {
  if (isDemoMode) return []
  const { data, error } = await db.rpc('admin_list_usage_logs', { p_limit: limit })
  if (error) throw new Error(error.message)
  return (data as AdminUsageLogRow[]) ?? []
}
