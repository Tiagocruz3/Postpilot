import * as React from "react"
import { cn } from "@/lib/utils"

const Dialog = ({
  open,
  onOpenChange,
  children,
  panelClassName,
}: {
  open?: boolean
  onOpenChange?: (v: boolean) => void
  children: React.ReactNode
  panelClassName?: string
}) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => onOpenChange?.(false)}>
      <div
        className={cn(
          'relative z-50 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-card p-6 shadow-lg',
          panelClassName,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex shrink-0 flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
)

const DialogTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
)

const DialogDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props} />
)

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex shrink-0 flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />
)

export { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter }
