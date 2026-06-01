import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TOP_UP_PACKS } from '@/lib/credits/constants'
import { useCredits } from '@/contexts/CreditContext'
import { cn } from '@/lib/utils'

type TopUpCreditsModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TopUpCreditsModal({ open, onOpenChange }: TopUpCreditsModalProps) {
  const { addTopUp } = useCredits()
  const [selectedId, setSelectedId] = useState<string>(TOP_UP_PACKS[1].id)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const selected = TOP_UP_PACKS.find((pack) => pack.id === selectedId) ?? TOP_UP_PACKS[0]

  const handleCheckout = async () => {
    setBusy(true)
    setMessage('')
    try {
      // Stripe checkout would plug in here; for now we add credits after confirmation.
      await addTopUp(selected.credits)
      setMessage(`${selected.credits.toLocaleString()} credits added. Top-up credits never expire.`)
      setTimeout(() => onOpenChange(false), 1200)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Checkout failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} panelClassName="w-full max-w-lg p-6">
      <DialogHeader>
        <DialogTitle>Top up AI credits</DialogTitle>
        <DialogDescription>
          Top-up credits never expire and are used only after your monthly plan credits run out.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2 py-2">
        {TOP_UP_PACKS.map((pack) => (
          <button
            key={pack.id}
            type="button"
            onClick={() => setSelectedId(pack.id)}
            className={cn(
              'flex items-center justify-between rounded-xl border p-4 text-left transition-colors',
              selectedId === pack.id ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'hover:bg-muted/50',
            )}
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{pack.name}</p>
                {pack.bestValue ? <Badge>Best value</Badge> : null}
              </div>
              <p className="text-sm text-muted-foreground">{pack.credits.toLocaleString()} credits</p>
            </div>
            <p className="text-lg font-semibold">${pack.price}</p>
          </button>
        ))}
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={() => void handleCheckout()} disabled={busy}>
          {busy ? 'Processing…' : `Continue - $${selected.price}`}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
