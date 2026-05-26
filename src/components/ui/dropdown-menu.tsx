import * as React from "react"
import { cn } from "@/lib/utils"

interface DropdownMenuContextValue {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null)

function useDropdownMenu() {
  const context = React.useContext(DropdownMenuContext)
  if (!context) {
    throw new Error("Dropdown menu components must be used within DropdownMenu")
  }
  return context
}

const DropdownMenu = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [open])

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div ref={containerRef} className="relative inline-block w-full">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  )
}

const DropdownMenuTrigger = ({ children }: { children: React.ReactNode }) => {
  const { open, setOpen } = useDropdownMenu()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setOpen(!open)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          setOpen(!open)
        }
      }}
    >
      {children}
    </div>
  )
}

const DropdownMenuContent = ({
  children,
  className,
  side = "bottom",
}: {
  children: React.ReactNode
  className?: string
  /** `top` opens above the trigger (for bottom-of-screen triggers). */
  side?: "top" | "bottom"
}) => {
  const { open } = useDropdownMenu()

  if (!open) {
    return null
  }

  return (
    <div
      className={cn(
        "absolute left-0 z-50 min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        side === "top" ? "bottom-full mb-2" : "top-full mt-2",
        className
      )}
    >
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
}) => {
  const { setOpen } = useDropdownMenu()

  return (
    <button
      type="button"
      onClick={(event) => {
        onClick?.(event)
        setOpen(false)
      }}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
        className
      )}
    >
      {children}
    </button>
  )
}

const DropdownMenuSeparator = ({ className }: { className?: string }) => (
  <div className={cn("-mx-1 my-1 h-px bg-muted", className)} />
)

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator }
