import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useConfirm } from '@/components/ConfirmProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminDeletePlan, adminSavePlan } from '@/lib/admin/rpc'
import type { SubscriptionPlanRow } from '@/lib/admin/types'

const emptyPlan = (): SubscriptionPlanRow => ({
  id: `plan_${Date.now()}`,
  name: 'New Plan',
  monthly_price: 29,
  monthly_credits: 1000,
  posts_limit: 50,
  images_limit: 30,
  videos_limit: 5,
  social_accounts_limit: 3,
  team_members_limit: 3,
  access_ads: true,
  access_premium_video: false,
  access_analytics: true,
  access_scheduling: true,
  access_ai_vault: true,
  status: 'active',
  featured: false,
  sort_order: 99,
})

type AdminPlansTabProps = {
  plans: SubscriptionPlanRow[]
  onRefresh: () => Promise<void>
  onMessage: (msg: string) => void
}

export function AdminPlansTab({ plans, onRefresh, onMessage }: AdminPlansTabProps) {
  const confirm = useConfirm()
  const [editing, setEditing] = useState<SubscriptionPlanRow | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!editing) return
    setBusy(true)
    try {
      await adminSavePlan(editing)
      onMessage('Plan saved.')
      setEditing(null)
      await onRefresh()
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    const ok = await confirm({
      title: 'Delete this plan?',
      description: 'Users on this plan will need to be migrated manually.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    })
    if (!ok) return
    setBusy(true)
    try {
      await adminDeletePlan(id)
      onMessage('Plan deleted.')
      await onRefresh()
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Membership plans</CardTitle>
            <CardDescription>Create, edit, enable, or disable subscription tiers.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setEditing(emptyPlan())}>
            <Plus className="mr-2 h-4 w-4" />
            Add plan
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-xl border p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{plan.name}</p>
                <div className="flex gap-1">
                  {plan.featured ? <Badge>Popular</Badge> : null}
                  <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>{plan.status}</Badge>
                </div>
              </div>
              <p className="text-2xl font-bold">${plan.monthly_price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>{plan.monthly_credits.toLocaleString()} AI credits</li>
                <li>{plan.posts_limit} posts · {plan.images_limit} images · {plan.videos_limit} videos</li>
                <li>{plan.social_accounts_limit} social accounts</li>
              </ul>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => setEditing({ ...plan })}>Edit</Button>
                {plan.id !== 'free' ? (
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => void remove(plan.id)}>
                    Delete
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} panelClassName="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing?.id.startsWith('plan_') ? 'New plan' : `Edit ${editing?.name}`}</DialogTitle>
        </DialogHeader>
        {editing ? (
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto py-2 sm:grid-cols-2">
            <Field label="Plan ID" value={editing.id} onChange={(v) => setEditing({ ...editing, id: v })} disabled={!editing.id.startsWith('plan_')} />
            <Field label="Name" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
            <Field label="Monthly price ($)" type="number" value={String(editing.monthly_price)} onChange={(v) => setEditing({ ...editing, monthly_price: Number(v) })} />
            <Field label="Monthly credits" type="number" value={String(editing.monthly_credits)} onChange={(v) => setEditing({ ...editing, monthly_credits: Number(v) })} />
            <Field label="Posts limit" type="number" value={String(editing.posts_limit)} onChange={(v) => setEditing({ ...editing, posts_limit: Number(v) })} />
            <Field label="Images limit" type="number" value={String(editing.images_limit)} onChange={(v) => setEditing({ ...editing, images_limit: Number(v) })} />
            <Field label="Videos limit" type="number" value={String(editing.videos_limit)} onChange={(v) => setEditing({ ...editing, videos_limit: Number(v) })} />
            <Field label="Social accounts" type="number" value={String(editing.social_accounts_limit)} onChange={(v) => setEditing({ ...editing, social_accounts_limit: Number(v) })} />
            <div className="sm:col-span-2 flex flex-wrap gap-3 text-sm">
              {(
                [
                  ['access_ads', 'Ads'],
                  ['access_premium_video', 'Premium video'],
                  ['access_analytics', 'Analytics'],
                  ['access_scheduling', 'Scheduling'],
                  ['access_ai_vault', 'AI Vault'],
                  ['featured', 'Featured'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editing[key]}
                    onChange={(e) => setEditing({ ...editing, [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="sm:col-span-2">
              <Label>Status</Label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border px-3 text-sm"
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as 'active' | 'disabled' })}
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          <Button disabled={busy} onClick={() => void save()}>Save plan</Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  disabled?: boolean
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
