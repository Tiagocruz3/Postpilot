import { useNavigate } from 'react-router-dom'
import { CalendarDays, Images, LayoutDashboard, PenTool, BarChart3, Settings, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const FOOTER_LINKS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/compose', label: 'Compose', icon: PenTool },
  { path: '/planner', label: 'Planner', icon: CalendarDays },
  { path: '/library', label: 'AI Library', icon: Images },
  { path: '/ads', label: 'Ads', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
] as const

type AppFooterProps = {
  className?: string
  compact?: boolean
}

export function AppFooter({ className, compact = false }: AppFooterProps) {
  const navigate = useNavigate()
  const year = new Date().getFullYear()

  return (
    <footer
      className={cn(
        'relative shrink-0 overflow-hidden border-t border-white/10 bg-gradient-to-br from-[hsl(200,85%,42%)] via-[hsl(205,78%,32%)] to-[hsl(215,70%,22%)] text-white',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.12),transparent_55%)]" />
      <div className="pointer-events-none absolute -left-20 top-0 h-40 w-40 rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 bottom-0 h-32 w-32 rounded-full bg-sky-300/10 blur-2xl" />

      <div className={cn('relative mx-auto max-w-6xl', compact ? 'px-4 py-5' : 'px-6 py-8')}>
        <div className={cn('flex flex-col gap-6', !compact && 'md:flex-row md:items-start md:justify-between')}>
          <div className="max-w-sm space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-sm font-bold shadow-sm ring-1 ring-white/20">
                A
              </div>
              <div>
                <p className="text-base font-semibold tracking-tight">Ad Guru</p>
                <p className="text-xs text-sky-100/80">Social + ads workspace</p>
              </div>
            </div>
            {!compact ? (
              <p className="text-sm leading-relaxed text-sky-50/85">
                Plan, compose, and publish with AI across Facebook, Instagram, LinkedIn, and X — all in one workspace.
              </p>
            ) : null}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-sky-50 ring-1 ring-white/10">
              <Sparkles className="h-3 w-3" />
              Built for teams who move fast
            </div>
          </div>

          {!compact ? (
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
              {FOOTER_LINKS.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className="group inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-sky-50/90 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Icon className="h-3.5 w-3.5 text-sky-200/70 transition-colors group-hover:text-white" />
                    {item.label}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            'mt-6 flex flex-col gap-2 border-t border-white/10 pt-4 text-xs text-sky-100/70 sm:flex-row sm:items-center sm:justify-between',
            compact && 'mt-4 pt-3',
          )}
        >
          <p>© {year} Ad Guru. All rights reserved.</p>
          <p className="text-sky-100/60">adguru.app</p>
        </div>
      </div>
    </footer>
  )
}
