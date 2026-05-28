import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/hooks/useAuth'
import { isDemoMode } from '@/lib/demo'
import {
  buildCreditBalance,
  canAfford,
  getCreditCost,
  isPlatformAdminEmail,
  type CreditBalanceView,
  type UserCreditAccountRow,
} from '@/lib/credits/account'
import {
  ACTION_LABELS,
  creditActionForFunction,
  EMPTY_CREDIT_MESSAGE,
  type CreditActionType,
  type MembershipPlanId,
} from '@/lib/credits/constants'
import { addDemoTopup, consumeDemoCredits, getDemoCreditAccount } from '@/lib/credits/demo'
import {
  rpcAddTopupCredits,
  rpcConsumeCredits,
  rpcEnsureCreditAccount,
  rpcIsPlatformAdmin,
} from '@/lib/credits/rpc'
import { supabase } from '@/lib/supabase'

export type CreditUsageLog = {
  id: string
  action_type: string
  credits_used: number
  balance_after: number | null
  model_used: string | null
  account_role: string
  created_at: string
  metadata: Record<string, unknown>
}

type CreditContextValue = {
  loading: boolean
  balance: CreditBalanceView
  account: UserCreditAccountRow | null
  usageLogs: CreditUsageLog[]
  refresh: () => Promise<void>
  consumeCredits: (
    action: CreditActionType,
    options?: { workspaceId?: string | null; modelUsed?: string; metadata?: Record<string, unknown> },
  ) => Promise<{ ok: boolean; error?: string }>
  consumeForFunction: (
    functionName: string,
    body?: Record<string, unknown>,
    options?: { workspaceId?: string | null; modelUsed?: string },
  ) => Promise<{ ok: boolean; error?: string }>
  checkCredits: (action: CreditActionType) => { ok: boolean; error?: string }
  addTopUp: (credits: number) => Promise<void>
  setMembershipPlan: (plan: MembershipPlanId) => Promise<void>
}

const CreditContext = createContext<CreditContextValue | null>(null)

export function CreditProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [account, setAccount] = useState<UserCreditAccountRow | null>(null)
  const [usageLogs, setUsageLogs] = useState<CreditUsageLog[]>([])

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setAccount(null)
      setUsageLogs([])
      setIsAdmin(false)
      setLoading(false)
      return
    }

    const adminByEmail = isPlatformAdminEmail(user.email)
    setIsAdmin(adminByEmail)

    if (isDemoMode) {
      setIsAdmin(adminByEmail || user.email === 'demo@adguru.app')
      setAccount(getDemoCreditAccount(user.id, adminByEmail))
      setUsageLogs([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      if (adminByEmail) {
        await supabase.from('user_roles').upsert({ user_id: user.id, role: 'admin' } as never, {
          onConflict: 'user_id,role',
        })
      }

      const platformAdmin = (await rpcIsPlatformAdmin(user.id)) || adminByEmail
      setIsAdmin(platformAdmin)

      const acctData = await rpcEnsureCreditAccount(user.id)
      if (acctData) setAccount(acctData)

      const { data: logs } = await supabase
        .from('credit_usage_logs')
        .select('id, action_type, credits_used, balance_after, model_used, account_role, created_at, metadata')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      setUsageLogs((logs ?? []) as CreditUsageLog[])
    } catch {
      setAccount(null)
    } finally {
      setLoading(false)
    }
  }, [user?.id, user?.email])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const balance = useMemo(
    () => buildCreditBalance(account, isAdmin, account?.membership_plan ?? 'free'),
    [account, isAdmin],
  )

  const checkCredits = useCallback(
    (action: CreditActionType) => {
      if (canAfford(balance, action)) return { ok: true }
      return { ok: false, error: EMPTY_CREDIT_MESSAGE }
    },
    [balance],
  )

  const consumeCredits = useCallback(
    async (
      action: CreditActionType,
      options?: { workspaceId?: string | null; modelUsed?: string; metadata?: Record<string, unknown> },
    ) => {
      const cost = getCreditCost(action)
      const check = checkCredits(action)
      if (!check.ok) return check

      if (!user?.id) return { ok: false, error: 'Sign in to use AI credits.' }

      if (isDemoMode) {
        if (!isAdmin) consumeDemoCredits(cost)
        await refresh()
        return { ok: true }
      }

      try {
        const result = await rpcConsumeCredits({
          action,
          credits: cost,
          workspaceId: options?.workspaceId,
          modelUsed: options?.modelUsed,
          metadata: {
            label: ACTION_LABELS[action],
            ...(options?.metadata ?? {}),
          },
        })
        if (!result?.success) {
          return { ok: false, error: result?.error || EMPTY_CREDIT_MESSAGE }
        }
        await refresh()
        return { ok: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not record AI usage.'
        return { ok: false, error: message }
      }
    },
    [checkCredits, isAdmin, refresh, user?.id],
  )

  const consumeForFunction = useCallback(
    async (
      functionName: string,
      body?: Record<string, unknown>,
      options?: { workspaceId?: string | null; modelUsed?: string },
    ) => {
      const action = creditActionForFunction(functionName, body)
      return consumeCredits(action, {
        workspaceId: options?.workspaceId,
        modelUsed: options?.modelUsed,
        metadata: { function: functionName },
      })
    },
    [consumeCredits],
  )

  const addTopUp = useCallback(
    async (credits: number) => {
      if (!user?.id) return
      if (isDemoMode) {
        addDemoTopup(credits)
        await refresh()
        return
      }
      await rpcAddTopupCredits(credits)
      await refresh()
    },
    [refresh, user?.id],
  )

  const setMembershipPlan = useCallback(
    async (plan: MembershipPlanId) => {
      if (!user?.id || isDemoMode) return
      await supabase
        .from('user_credit_accounts')
        .update({ membership_plan: plan } as never)
        .eq('user_id', user.id)
      await refresh()
    },
    [refresh, user?.id],
  )

  const value = useMemo(
    () => ({
      loading,
      balance,
      account,
      usageLogs,
      refresh,
      consumeCredits,
      consumeForFunction,
      checkCredits,
      addTopUp,
      setMembershipPlan,
    }),
    [
      loading,
      balance,
      account,
      usageLogs,
      refresh,
      consumeCredits,
      consumeForFunction,
      checkCredits,
      addTopUp,
      setMembershipPlan,
    ],
  )

  return <CreditContext.Provider value={value}>{children}</CreditContext.Provider>
}

export function useCredits() {
  const ctx = useContext(CreditContext)
  if (!ctx) throw new Error('useCredits must be used within CreditProvider')
  return ctx
}
