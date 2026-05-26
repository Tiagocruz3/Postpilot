import * as React from "react"
import { cn } from "@/lib/utils"

const Tabs = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <div className={cn("w-full", className)}>{children}</div>
}

const TabsList = ({ className, children }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground", className)}>
    {children}
  </div>
)

const TabsTrigger = ({ value, activeValue, onClick, className, children }: { value: string; activeValue: string; onClick: (v: string) => void; className?: string; children: React.ReactNode }) => (
  <button
    onClick={() => onClick(value)}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      activeValue === value ? "bg-background text-foreground shadow" : "hover:bg-background/50 hover:text-foreground",
      className
    )}
  >
    {children}
  </button>
)

const TabsContent = ({ value, activeValue, className, children }: { value: string; activeValue: string; className?: string; children: React.ReactNode }) => {
  if (value !== activeValue) return null
  return <div className={cn("mt-2", className)}>{children}</div>
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
