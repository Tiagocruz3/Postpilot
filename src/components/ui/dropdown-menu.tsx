import * as React from "react"
import { cn } from "@/lib/utils"

interface DropdownMenuContextValue {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
}

type DropdownMenuChildProps = Partial<DropdownMenuContextValue>

const DropdownMenu = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="relative inline-block">
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<DropdownMenuChildProps>, { open, setOpen })
          : child
      )}
    </div>
  )
}

const DropdownMenuTrigger = ({
  children,
  open,
  setOpen,
}: {
  children: React.ReactNode
} & DropdownMenuChildProps) => (
  <div role="button" tabIndex={0} onClick={() => setOpen?.(!open)} onKeyDown={(event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      setOpen?.(!open)
    }
  }}>
    {children}
  </div>
)

const DropdownMenuContent = ({
  children,
  open,
  className,
}: {
  children: React.ReactNode
  className?: string
} & DropdownMenuChildProps) => {
  if (!open) return null
  return (
    <div className={cn("absolute right-0 z-50 mt-2 min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md", className)}>
      {children}
    </div>
  )
}

const DropdownMenuItem = ({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  className?: string
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn("relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground", className)}
  >
    {children}
  </button>
)

const DropdownMenuSeparator = ({ className }: { className?: string }) => (
  <div className={cn("-mx-1 my-1 h-px bg-muted", className)} />
)

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator }
