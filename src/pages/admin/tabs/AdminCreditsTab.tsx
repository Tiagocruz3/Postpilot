import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminSaveCreditRules } from '@/lib/admin/rpc'
import type { CreditRulesMap } from '@/lib/admin/types'
import { ACTION_LABELS, type CreditActionType } from '@/lib/credits/constants'

const RULE_KEYS: { key: CreditActionType; label: string }[] = [
  { key: 'caption', label: ACTION_LABELS.caption },
  { key: 'hashtags', label: ACTION_LABELS.hashtags },
  { key: 'post_idea', label: ACTION_LABELS.post_idea },
  { key: 'ad_copy', label: ACTION_LABELS.ad_copy },
  { key: 'image', label: ACTION_LABELS.image },
  { key: 'video_short', label: ACTION_LABELS.video_short },
  { key: 'video_premium', label: ACTION_LABELS.video_premium },
]

type AdminCreditsTabProps = {
  rules: CreditRulesMap
  onRefresh: () => Promise<void>
  onMessage: (msg: string) => void
}

export function AdminCreditsTab({ rules, onRefresh, onMessage }: AdminCreditsTabProps) {
  const [local, setLocal] = useState<Record<string, number>>({ ...rules })
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      await adminSaveCreditRules(local)
      onMessage('Credit rules saved.')
      await onRefresh()
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit rules</CardTitle>
        <CardDescription>
          Credits per AI action. Monthly credits reset each billing cycle; top-up credits are used after monthly allowance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {RULE_KEYS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label className="text-sm">{label}</Label>
              <Input
                type="number"
                className="w-20"
                value={local[key] ?? 0}
                onChange={(e) => setLocal({ ...local, [key]: Number(e.target.value) })}
              />
            </div>
          ))}
        </div>
        <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
          <li>Admin users have unlimited credits and bypass all checks.</li>
          <li>Members are blocked from AI generation at 0 credits.</li>
          <li>Scheduling, publishing, and viewing history remain available without credits.</li>
        </ul>
        <Button disabled={busy} onClick={() => void save()}>Save credit rules</Button>
      </CardContent>
    </Card>
  )
}
