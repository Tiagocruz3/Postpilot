import { useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminSaveSubscriptionSettings } from '@/lib/admin/rpc'
import type { AdminAuditLogRow, SubscriptionSettingsMap } from '@/lib/admin/types'

type AdminSubscriptionSettingsTabProps = {
  settings: SubscriptionSettingsMap
  auditLogs: AdminAuditLogRow[]
  onRefresh: () => Promise<void>
  onMessage: (msg: string) => void
}

export function AdminSubscriptionSettingsTab({
  settings,
  auditLogs,
  onRefresh,
  onMessage,
}: AdminSubscriptionSettingsTabProps) {
  const [local, setLocal] = useState(settings)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      await adminSaveSubscriptionSettings(local)
      onMessage('Settings saved.')
      await onRefresh()
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Subscription settings</CardTitle>
          <CardDescription>Platform-wide billing and access controls.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Toggle label="Enable free plan" checked={local.enableFreePlan} onChange={(v) => setLocal({ ...local, enableFreePlan: v })} />
          <Toggle label="Enable trials" checked={local.enableTrials} onChange={(v) => setLocal({ ...local, enableTrials: v })} />
          <div className="grid gap-1.5">
            <Label>Trial length (days)</Label>
            <Input type="number" value={local.trialDays} onChange={(e) => setLocal({ ...local, trialDays: Number(e.target.value) })} />
          </div>
          <Toggle label="Allow top-ups" checked={local.allowTopUp} onChange={(v) => setLocal({ ...local, allowTopUp: v })} />
          <Toggle label="Allow upgrades" checked={local.allowUpgrade} onChange={(v) => setLocal({ ...local, allowUpgrade: v })} />
          <Toggle label="Allow downgrades" checked={local.allowDowngrade} onChange={(v) => setLocal({ ...local, allowDowngrade: v })} />
          <Toggle label="Allow cancellations" checked={local.allowCancel} onChange={(v) => setLocal({ ...local, allowCancel: v })} />
          <div className="grid gap-1.5">
            <Label>Low credit warning (%)</Label>
            <Input
              type="number"
              value={local.lowCreditThresholdPercent}
              onChange={(e) => setLocal({ ...local, lowCreditThresholdPercent: Number(e.target.value) })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Critical credit warning (%)</Label>
            <Input
              type="number"
              value={local.criticalCreditThresholdPercent}
              onChange={(e) => setLocal({ ...local, criticalCreditThresholdPercent: Number(e.target.value) })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Currency</Label>
            <Input value={local.currency} onChange={(e) => setLocal({ ...local, currency: e.target.value })} />
          </div>
          <Toggle label="Tax / GST enabled" checked={local.taxEnabled} onChange={(v) => setLocal({ ...local, taxEnabled: v })} />
          <div className="grid gap-1.5">
            <Label>Tax rate (%)</Label>
            <Input type="number" value={local.taxRatePercent} onChange={(e) => setLocal({ ...local, taxRatePercent: Number(e.target.value) })} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Billing provider</Label>
            <Input value={local.billingProvider} onChange={(e) => setLocal({ ...local, billingProvider: e.target.value })} />
          </div>
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            OpenRouter and fal.ai model settings are in Settings → Content AI / Image AI / Video AI (platform admin only).
          </p>
          <Button disabled={busy} onClick={() => void save()} className="sm:col-span-2 w-fit">
            Save settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
          <CardDescription>Admin actions are recorded automatically.</CardDescription>
        </CardHeader>
        <CardContent className="max-h-80 overflow-y-auto">
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {auditLogs.map((log) => (
                <li key={log.id} className="rounded-lg border px-3 py-2">
                  <p className="font-medium">{log.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.admin_email} · {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                    {log.target_type ? ` · ${log.target_type}/${log.target_id ?? ''}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}
