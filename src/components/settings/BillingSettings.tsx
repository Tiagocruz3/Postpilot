import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useCredits } from '@/contexts/CreditContext'
import { MEMBERSHIP_PLANS, type MembershipPlanId } from '@/lib/credits/constants'
import { cn } from '@/lib/utils'

const PLAN_ORDER: MembershipPlanId[] = ['free', 'starter', 'pro', 'growth', 'agency']

export function BillingSettings() {
  const { balance, setMembershipPlan, loading } = useCredits()

  if (balance.isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <CardDescription>Admin accounts have unlimited AI credits and are not billed.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Current plan</CardTitle>
          <CardDescription>
            You are on the <strong>{balance.planName}</strong> plan. Monthly credits reset every billing cycle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            ${MEMBERSHIP_PLANS[balance.planId].priceMonthly}/month ·{' '}
            {MEMBERSHIP_PLANS[balance.planId].monthlyCredits.toLocaleString()} AI credits
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {PLAN_ORDER.map((planId) => {
          const plan = MEMBERSHIP_PLANS[planId]
          const current = balance.planId === planId
          return (
            <Card key={planId} className={cn(current && 'border-primary ring-1 ring-primary/20')}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  {current ? <Badge>Current</Badge> : null}
                </div>
                <CardDescription>
                  ${plan.priceMonthly}/mo · {plan.monthlyCredits.toLocaleString()} credits
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <p>{plan.postsPerMonth} posts · {plan.imagesPerMonth} images · {plan.videosPerMonth} videos</p>
                <p>{plan.socialAccounts} social accounts</p>
                {!current && planId !== 'free' ? (
                  <Button
                    size="sm"
                    className="mt-2 w-full"
                    disabled={loading}
                    onClick={() => void setMembershipPlan(planId)}
                  >
                    Switch to {plan.name}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Paid checkout via Stripe can be connected here. Plan switches above update your workspace allowance immediately
        for testing.
      </p>
    </div>
  )
}
