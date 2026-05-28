import { supabase } from '@/lib/supabase'
import type { CreditActionType } from '@/lib/credits/constants'
import { creditActionForFunction } from '@/lib/credits/constants'

export type CreditConsumeFn = (
  action: CreditActionType,
  options?: { workspaceId?: string | null; modelUsed?: string; metadata?: Record<string, unknown> },
) => Promise<{ ok: boolean; error?: string }>

export async function invokeAiWithCredits<T>(
  functionName: string,
  body: Record<string, unknown>,
  consume: CreditConsumeFn,
  options?: { workspaceId?: string | null; skipConsume?: boolean },
): Promise<T> {
  if (!options?.skipConsume) {
    const action = creditActionForFunction(functionName, body)
    const gate = await consume(action, {
      workspaceId: options?.workspaceId,
      metadata: { function: functionName },
    })
    if (!gate.ok) {
      throw new Error(gate.error ?? 'Insufficient AI credits.')
    }
  }

  const { data, error } = await supabase.functions.invoke(functionName, { body })
  if (error) {
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context
    if (context?.json) {
      try {
        const errorPayload = (await context.json()) as { error?: string; message?: string }
        const detailedMessage = errorPayload?.error || errorPayload?.message
        if (detailedMessage) throw new Error(detailedMessage)
      } catch (contextError) {
        if (contextError instanceof Error && contextError.message) throw contextError
      }
    }
    throw new Error(error.message || 'AI request failed.')
  }
  const payload = data as T & { error?: string }
  if (payload && typeof payload === 'object' && 'error' in payload && payload.error) {
    throw new Error(payload.error)
  }
  return data as T
}
