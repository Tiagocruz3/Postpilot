import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

const Dialog = ({
  open,
  forceMount,
  onOpenChange,
  children,
  panelClassName,
  panelStyle,
  overlayClassName,
}: {
  open?: boolean
  forceMount?: boolean
  onOpenChange?: (v: boolean) => void
  children: React.ReactNode
  panelClassName?: string
  panelStyle?: React.CSSProperties
  overlayClassName?: string
}) => {
  if (!open && !forceMount) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-2 sm:p-3 transition-opacity duration-200',
        !open && 'pointer-events-none opacity-0',
        overlayClassName,
      )}
      onClick={() => onOpenChange?.(false)}
      aria-hidden={!open}
    >
      <div
        className={cn(
          'relative z-50 flex max-h-[92vh] flex-col overflow-hidden rounded-2xl border bg-card shadow-lg transition-opacity duration-200',
          !open && 'scale-[0.98] opacity-0',
          panelClassName ?? 'w-full max-w-lg p-6',
        )}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
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
