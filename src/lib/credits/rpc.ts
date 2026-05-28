import { supabase } from '@/lib/supabase'
import type { CreditActionType } from '@/lib/credits/constants'
import type { UserCreditAccountRow } from '@/lib/credits/account'

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
}

const db = supabase as unknown as RpcClient

export async function rpcIsPlatformAdmin(userId: string): Promise<boolean> {
  const { data, error } = await db.rpc('is_platform_admin', { p_user_id: userId })
  if (error) return false
  return Boolean(data)
}

export async function rpcEnsureCreditAccount(userId: string): Promise<UserCreditAccountRow | null> {
  const { data, error } = await db.rpc('ensure_user_credit_account', { p_user_id: userId })
  if (error) throw new Error(error.message)
  return (data as UserCreditAccountRow | null) ?? null
}

export async function rpcConsumeCredits(params: {
  action: CreditActionType
  credits: number
  workspaceId?: string | null
  modelUsed?: string | null
  metadata?: Record<string, unknown>
}): Promise<{ success?: boolean; error?: string; unlimited?: boolean; balance_after?: number | null }> {
  const { data, error } = await db.rpc('consume_ai_credits', {
    p_action_type: params.action,
    p_credits: params.credits,
    p_workspace_id: params.workspaceId ?? null,
    p_model_used: params.modelUsed ?? null,
    p_metadata: params.metadata ?? {},
  })
  if (error) throw new Error(error.message)
  return (data as { success?: boolean; error?: string; unlimited?: boolean; balance_after?: number | null }) ?? {}
}

export async function rpcAddTopupCredits(credits: number): Promise<void> {
  const { error } = await db.rpc('add_topup_credits', { p_credits: credits })
  if (error) throw new Error(error.message)
}
