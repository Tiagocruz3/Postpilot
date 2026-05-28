export type AdminUserRow = {
  user_id: string
  name: string
  email: string
  role: 'admin' | 'member'
  plan: string
  subscription_status: string
  monthly_credits: number
  topup_credits: number
  credits_used: number
  posts_used: number
  images_used: number
  videos_used: number
  joined_at: string
  suspended_at: string | null
}

export type SubscriptionPlanRow = {
  id: string
  name: string
  monthly_price: number
  monthly_credits: number
  posts_limit: number
  images_limit: number
  videos_limit: number
  social_accounts_limit: number
  team_members_limit: number
  access_ads: boolean
  access_premium_video: boolean
  access_analytics: boolean
  access_scheduling: boolean
  access_ai_vault: boolean
  status: 'active' | 'disabled'
  featured: boolean
  sort_order: number
}

export type TopupPackRow = {
  id: string
  name: string
  credits: number
  price: number
  best_value: boolean
  active: boolean
  sort_order: number
}

export type CreditRulesMap = Record<string, number>

export type SubscriptionSettingsMap = {
  enableFreePlan: boolean
  enableTrials: boolean
  trialDays: number
  allowTopUp: boolean
  allowUpgrade: boolean
  allowDowngrade: boolean
  allowCancel: boolean
  lowCreditThresholdPercent: number
  criticalCreditThresholdPercent: number
  currency: string
  taxEnabled: boolean
  taxRatePercent: number
  billingProvider: string
}

export type AdminAuditLogRow = {
  id: string
  admin_user_id: string
  admin_email: string
  action: string
  target_type: string | null
  target_id: string | null
  old_value: unknown
  new_value: unknown
  created_at: string
}

export type AdminUsageLogRow = {
  id: string
  user_id: string
  user_name: string
  user_email: string
  role: string
  plan: string
  action_type: string
  ai_provider: string
  model_used: string | null
  credits_used: number
  cost_estimate: number
  balance_after: number | null
  created_at: string
}

export type AdminSubscriptionConfig = {
  plans: SubscriptionPlanRow[]
  topups: TopupPackRow[]
  credit_rules: CreditRulesMap
  settings: SubscriptionSettingsMap
  audit_logs: AdminAuditLogRow[]
}

export const DEFAULT_SUBSCRIPTION_SETTINGS: SubscriptionSettingsMap = {
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
}
