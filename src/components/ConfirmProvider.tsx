import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export type ConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

type ConfirmState = ConfirmOptions & {
  resolve: (confirmed: boolean) => void
}

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ConfirmState | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve })
    })
  }, [])

  const finish = (confirmed: boolean) => {
    pending?.resolve(confirmed)
    setPending(null)
  }

  const variant = pending?.variant ?? 'default'

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && finish(false)}>
        <DialogHeader>
          <DialogTitle>{pending?.title}</DialogTitle>
          {pending?.description ? <DialogDescription>{pending.description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => finish(false)}>
            {pending?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            type="button"
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={() => finish(true)}
          >
            {pending?.confirmLabel ?? (variant === 'destructive' ? 'Delete' : 'Confirm')}
          </Button>
        </DialogFooter>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider')
  }
  return context.confirm
}
