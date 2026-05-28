import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CREDIT_COSTS, MEMBERSHIP_PLANS, TOP_UP_PACKS, ACTION_LABELS } from '@/lib/credits/constants'
import type { CreditActionType, MembershipPlanId } from '@/lib/credits/constants'

const PLAN_ORDER: MembershipPlanId[] = ['free', 'starter', 'pro', 'growth', 'agency']

export function AdminAppSettings() {
  return (
    <div className="space-y-6">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle>Platform admin</CardTitle>
          <CardDescription>
            Manage membership allowances, credit rules, and AI provider configuration. Changes to plans below are
            defined in app configuration; connect Stripe and database overrides for production billing.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Membership plans</CardTitle>
          <CardDescription>Monthly allowances per tier.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-4">Plan</th>
                <th className="pb-2 pr-4">Price</th>
                <th className="pb-2 pr-4">Credits</th>
                <th className="pb-2 pr-4">Posts</th>
                <th className="pb-2 pr-4">Images</th>
                <th className="pb-2 pr-4">Videos</th>
                <th className="pb-2">Accounts</th>
              </tr>
            </thead>
            <tbody>
              {PLAN_ORDER.map((id) => {
                const p = MEMBERSHIP_PLANS[id]
                return (
                  <tr key={id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{p.name}</td>
                    <td className="py-2 pr-4">${p.priceMonthly}</td>
                    <td className="py-2 pr-4">{p.monthlyCredits.toLocaleString()}</td>
                    <td className="py-2 pr-4">{p.postsPerMonth}</td>
                    <td className="py-2 pr-4">{p.imagesPerMonth}</td>
                    <td className="py-2 pr-4">{p.videosPerMonth}</td>
                    <td className="py-2">{p.socialAccounts}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI credit costs</CardTitle>
          <CardDescription>Credits deducted per action (members only).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(CREDIT_COSTS) as CreditActionType[]).map((action) => (
            <div key={action} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span>{ACTION_LABELS[action]}</span>
              <Badge variant="secondary">{CREDIT_COSTS[action]} credits</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top-up packs</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {TOP_UP_PACKS.map((pack) => (
            <div key={pack.id} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">
                {pack.name} {pack.bestValue ? <Badge className="ml-1">Best value</Badge> : null}
              </p>
              <p className="text-muted-foreground">
                {pack.credits.toLocaleString()} credits · ${pack.price}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Use the <strong>Content AI</strong>, <strong>Image AI</strong>, <strong>Video AI</strong>, and{' '}
        <strong>Local AI</strong> tabs to configure OpenRouter and fal.ai models for all workspaces.
      </p>
    </div>
  )
}
