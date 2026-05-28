import { format } from 'date-fns'
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useCredits } from '@/contexts/CreditContext'
import { ACTION_LABELS, type CreditActionType } from '@/lib/credits/constants'

type UsageHistoryModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  email?: string
}

export function UsageHistoryModal({ open, onOpenChange, email }: UsageHistoryModalProps) {
  const { usageLogs, balance, loading } = useCredits()

  return (
    <Dialog open={open} onOpenChange={onOpenChange} panelClassName="w-full max-w-2xl p-6">
      <DialogHeader>
        <DialogTitle>Usage history</DialogTitle>
        <DialogDescription>
          AI credit usage for {email ?? 'your account'}
          {balance.isAdmin ? ' · Admin (unlimited)' : ''}.
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[min(60vh,28rem)] overflow-auto rounded-xl border">
        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : usageLogs.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No AI usage recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b bg-muted/80 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium text-right">Credits</th>
                <th className="px-3 py-2 font-medium text-right">Balance</th>
                <th className="px-3 py-2 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {usageLogs.map((log) => {
                const label =
                  ACTION_LABELS[log.action_type as CreditActionType] ??
                  String(log.action_type).replace(/_/g, ' ')
                return (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <p className="font-medium">{label}</p>
                      {log.model_used ? (
                        <p className="text-xs text-muted-foreground">{log.model_used}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), 'MMM d, yyyy · h:mm a')}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{log.credits_used}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {log.balance_after == null ? '∞' : log.balance_after.toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {log.account_role}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </Dialog>
  )
}
