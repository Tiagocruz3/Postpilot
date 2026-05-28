import { Infinity } from 'lucide-react'
import { formatCredits, type CreditBalanceView } from '@/lib/credits/account'
import { cn } from '@/lib/utils'

type CreditMeterProps = {
  balance: CreditBalanceView
  compact?: boolean
}

export function CreditMeter({ balance, compact = false }: CreditMeterProps) {
  if (balance.isAdmin) {
    return (
      <div className={cn('rounded-xl border bg-gradient-to-br from-primary/10 to-transparent p-3', compact && 'p-2.5')}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI credits</p>
          <Infinity className="h-4 w-4 text-primary" />
        </div>
        <p className="mt-1 text-lg font-semibold text-foreground">Unlimited</p>
        <p className="text-xs text-muted-foreground">No monthly limit</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/15">
          <div className="h-full w-full rounded-full bg-gradient-to-r from-primary/60 to-primary" />
        </div>
      </div>
    )
  }

  const used = balance.monthlyAllowance - balance.monthlyRemaining
  const usedFromPlan = Math.min(used, balance.monthlyAllowance)
  const usagePercent =
    balance.monthlyAllowance > 0
      ? Math.min(100, Math.round((usedFromPlan / balance.monthlyAllowance) * 100))
      : 0

  const barColor =
    balance.health === 'empty'
      ? 'bg-destructive'
      : balance.health === 'critical'
        ? 'bg-amber-500'
        : balance.health === 'low'
          ? 'bg-amber-400'
          : 'bg-primary'

  return (
    <div className={cn('rounded-xl border bg-muted/30 p-3', compact && 'p-2.5')}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI credits</p>
      <p className="mt-1 text-base font-semibold leading-tight">
        {formatCredits(balance.totalRemaining)}{' '}
        <span className="text-sm font-normal text-muted-foreground">
          / {formatCredits(balance.monthlyAllowance)} remaining
        </span>
      </p>
      {balance.topupBalance > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Includes {formatCredits(balance.topupBalance)} top-up credits
        </p>
      ) : null}
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${Math.max(4, 100 - usagePercent)}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Resets in {balance.daysUntilReset} {balance.daysUntilReset === 1 ? 'day' : 'days'}
      </p>
      {balance.statusMessage ? (
        <p
          className={cn(
            'mt-2 rounded-lg px-2 py-1.5 text-[11px] leading-snug',
            balance.health === 'empty' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-800 dark:text-amber-200',
          )}
        >
          {balance.statusMessage}
        </p>
      ) : null}
    </div>
  )
}
