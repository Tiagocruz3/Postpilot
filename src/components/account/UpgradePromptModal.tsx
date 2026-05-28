import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Lock, Sparkles, TrendingUp, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TopUpCreditsModal } from '@/components/account/TopUpCreditsModal'
import {
  ACTION_LABELS,
  MEMBERSHIP_PLANS,
  type CreditActionType,
  type MembershipPlanId,
} from '@/lib/credits/constants'
import { formatCredits, type CreditBalanceView } from '@/lib/credits/account'

export type UpgradePromptReason = 'insufficient_credits' | 'plan_locked'

export type UpgradePromptState = {
  open: boolean
  reason: UpgradePromptReason
  action?: CreditActionType
  minPlan?: MembershipPlanId
}

type UpgradePromptModalProps = {
  state: UpgradePromptState
  balance: CreditBalanceView
  onOpenChange: (open: boolean) => void
}

export function UpgradePromptModal({ state, balance, onOpenChange }: UpgradePromptModalProps) {
  const navigate = useNavigate()
  const [topUpOpen, setTopUpOpen] = useState(false)

  const isPlanLocked = state.reason === 'plan_locked'
  const actionLabel = state.action ? ACTION_LABELS[state.action] : 'this action'
  const minPlan = state.minPlan ? MEMBERSHIP_PLANS[state.minPlan] : null
  const currentPlanName = balance.planName

  const goToBilling = () => {
    onOpenChange(false)
    navigate('/app/settings', { state: { tab: 'billing' } })
  }

  return (
    <>
      <Dialog open={state.open} onOpenChange={onOpenChange} panelClassName="w-full max-w-md p-0">
        <div className="relative overflow-hidden">
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 h-32 ${
              isPlanLocked
                ? 'bg-gradient-to-b from-primary/15 via-sky-500/10 to-transparent'
                : 'bg-gradient-to-b from-amber-500/15 via-amber-400/10 to-transparent'
            }`}
          />

          <div className="relative px-6 pb-2 pt-6">
            <div
              className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${
                isPlanLocked
                  ? 'bg-primary/15 text-primary'
                  : 'bg-amber-500/15 text-amber-600'
              }`}
            >
              {isPlanLocked ? <Lock className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
            </div>

            <DialogHeader>
              <DialogTitle className="text-xl">
                {isPlanLocked
                  ? `${actionLabel} isn’t on the ${currentPlanName} plan`
                  : "You're out of AI credits"}
              </DialogTitle>
              <DialogDescription className="leading-6">
                {isPlanLocked
                  ? minPlan
                    ? `Upgrade to ${minPlan.name} or higher to unlock ${actionLabel.toLowerCase()} on your account.`
                    : `Upgrade your plan to unlock ${actionLabel.toLowerCase()}.`
                  : 'Top up your credits or upgrade your plan to keep creating without interruption.'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-3 px-6 py-4">
            <div className="rounded-2xl border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Current plan
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{currentPlanName}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Credit balance
                  </p>
                  <p
                    className={`mt-1 text-sm font-semibold tabular-nums ${
                      balance.totalRemaining <= 0 ? 'text-destructive' : 'text-foreground'
                    }`}
                  >
                    {formatCredits(balance.totalRemaining)}
                  </p>
                </div>
              </div>
              {!isPlanLocked && balance.daysUntilReset > 0 ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Monthly credits reset in {balance.daysUntilReset}{' '}
                  {balance.daysUntilReset === 1 ? 'day' : 'days'}.
                </p>
              ) : null}
            </div>

            {isPlanLocked && minPlan ? (
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 to-transparent p-4">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="h-4 w-4" />
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    {minPlan.name} plan includes
                  </p>
                </div>
                <ul className="mt-2 grid gap-1 text-sm text-foreground">
                  <li>• {minPlan.monthlyCredits.toLocaleString()} AI credits / month</li>
                  <li>• {minPlan.postsPerMonth.toLocaleString()} posts / month</li>
                  <li>• {minPlan.imagesPerMonth.toLocaleString()} AI images / month</li>
                  {minPlan.videosPerMonth > 0 ? (
                    <li>• {minPlan.videosPerMonth.toLocaleString()} AI videos / month</li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>

          <DialogFooter className="border-t bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Not now
            </Button>
            {!isPlanLocked ? (
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  setTopUpOpen(true)
                }}
              >
                <Zap className="mr-1.5 h-4 w-4" />
                Top up credits
              </Button>
            ) : null}
            <Button
              onClick={goToBilling}
              className="bg-gradient-to-r from-primary via-sky-500 to-cyan-500 text-white"
            >
              <TrendingUp className="mr-1.5 h-4 w-4" />
              {isPlanLocked && minPlan ? `Upgrade to ${minPlan.name}` : 'Upgrade plan'}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </DialogFooter>
        </div>
      </Dialog>

      <TopUpCreditsModal open={topUpOpen} onOpenChange={setTopUpOpen} />
    </>
  )
}
