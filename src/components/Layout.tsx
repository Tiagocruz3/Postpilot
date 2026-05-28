import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  PenTool,
  BarChart3,
  ChevronDown,
  CalendarDays,
  Building2,
  Sparkles,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Images,
  History,
} from 'lucide-react'
import { AccountMenu } from '@/components/account/AccountMenu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { APP_PAGE } from '@/lib/app-labels'
import { cn } from '@/lib/utils'
import { isDemoMode } from '@/lib/demo'
import { getPreferredDisplayName, loadUserPreferences } from '@/lib/user-preferences'

const SIDEBAR_TRANSITION = 'transition-[width,padding,margin] duration-200 ease-out'

export function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile } = useAuth()
  const { workspaces, loading } = useWorkspaces(profile?.id)
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem('sidebar_open') !== 'false')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(() =>
    localStorage.getItem('current_workspace_id')
  )

  const currentWorkspace = useMemo(() => {
    if (!workspaces.length) {
      return null
    }

    return workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? workspaces[0]
  }, [selectedWorkspaceId, workspaces])

  const handleWorkspaceChange = (id: string) => {
    setSelectedWorkspaceId(id)
    localStorage.setItem('current_workspace_id', id)
  }

  useEffect(() => {
    if (currentWorkspace) {
      localStorage.setItem('current_workspace_id', currentWorkspace.id)
    }
  }, [currentWorkspace])

  useEffect(() => {
    localStorage.setItem('sidebar_open', String(sidebarOpen))
  }, [sidebarOpen])

  const navItems = [
    { path: '/app', label: APP_PAGE.commandCenter, icon: LayoutDashboard, hint: 'Overview + quick actions' },
    { path: '/app/planner', label: APP_PAGE.contentCalendar, icon: CalendarDays, hint: 'Calendar + Google sync' },
    { path: '/app/compose', label: APP_PAGE.createStudio, icon: PenTool, hint: 'Write, research, remix' },
    { path: '/app/library', label: APP_PAGE.aiVault, icon: Images, hint: 'Generated images & video' },
    { path: '/app/ads', label: APP_PAGE.growthAds, icon: BarChart3, hint: 'Meta AI ad campaigns' },
    { path: '/app/history', label: APP_PAGE.activityLog, icon: History, hint: 'Published posts + metrics' },
  ]

  const handleSignOut = async () => {
    if (isDemoMode) {
      navigate('/', { replace: true })
      return
    }
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }
  const userPreferences = loadUserPreferences()
  const displayName = getPreferredDisplayName(profile?.display_name, userPreferences)

  if (!loading && workspaces.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-xl rounded-3xl border bg-card p-8 shadow-sm">
          <div className="mb-5 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Workspace bootstrap
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Create your first Ad Guru workspace</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Workspaces keep collaborators, social connections, ad accounts, planner tasks, and calendar sync isolated per team.
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border bg-background p-4">
              <Building2 className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm font-medium">Multi-tenant by default</p>
            </div>
            <div className="rounded-2xl border bg-background p-4">
              <CalendarDays className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm font-medium">Content Calendar-ready from day one</p>
            </div>
            <div className="rounded-2xl border bg-background p-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm font-medium">Built for AI-assisted workflows</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/workspace-setup')}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-600"
          >
            Create workspace
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full bg-background">
      <aside
        className={cn(
          'flex min-h-0 shrink-0 flex-col border-r bg-card',
          SIDEBAR_TRANSITION,
          sidebarOpen ? 'w-64' : 'w-[68px]'
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2 py-4',
            SIDEBAR_TRANSITION,
            sidebarOpen ? 'px-4' : 'px-3 justify-center'
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-sm">
            A
          </div>
          <div
            className={cn(
              'min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-opacity duration-150',
              sidebarOpen ? 'opacity-100 delay-100' : 'pointer-events-none opacity-0'
            )}
            aria-hidden={!sidebarOpen}
          >
            <span className="block truncate text-sm font-semibold tracking-tight text-foreground">Ad Guru</span>
            <span className="block truncate text-[11px] text-muted-foreground">Social + ads workspace</span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen((current) => !current)}
            className={cn(
              'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              sidebarOpen ? '' : 'absolute right-2 top-3'
            )}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
        </div>

        {currentWorkspace ? (
          <div
            className={cn(
              'pb-2',
              SIDEBAR_TRANSITION,
              sidebarOpen ? 'px-3' : 'px-2'
            )}
          >
            {sidebarOpen ? (
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button
                    variant="outline"
                    className="h-10 w-full justify-between rounded-lg px-3"
                  >
                    <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">{currentWorkspace.name}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full">
                  {workspaces.map((ws) => (
                    <DropdownMenuItem
                      key={ws.id}
                      onClick={() => handleWorkspaceChange(ws.id)}
                      className={cn(ws.id === currentWorkspace.id && 'bg-accent font-medium')}
                    >
                      {ws.name}
                      {ws.id === currentWorkspace.id ? ' · active' : ''}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/workspace-setup')}>New workspace</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div
                className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-input bg-muted/40 text-muted-foreground"
                title={currentWorkspace.name}
                aria-hidden="true"
              >
                <Building2 className="h-4 w-4" />
              </div>
            )}
          </div>
        ) : null}

        <nav
          className={cn(
            'min-h-0 flex-1 space-y-0.5 overflow-y-auto py-2',
            SIDEBAR_TRANSITION,
            sidebarOpen ? 'px-3' : 'px-2'
          )}
        >
          {navItems.map((item) => {
            const active =
              location.pathname === item.path ||
              (item.path === '/app' ? location.pathname === '/app' : location.pathname.startsWith(`${item.path}/`))
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'group relative flex w-full items-center rounded-lg text-sm font-medium transition-colors',
                  sidebarOpen ? 'h-10 gap-3 px-3' : 'h-10 justify-center px-0',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground/80 hover:bg-accent hover:text-foreground'
                )}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span
                  className={cn(
                    'flex-1 truncate text-left transition-opacity duration-150',
                    sidebarOpen ? 'opacity-100 delay-100' : 'pointer-events-none w-0 overflow-hidden opacity-0'
                  )}
                >
                  {item.label}
                </span>
              </button>
            )
          })}
        </nav>

        <div
          className={cn(
            'border-t py-3',
            SIDEBAR_TRANSITION,
            sidebarOpen ? 'px-3' : 'px-2'
          )}
        >
          <AccountMenu
            displayName={displayName}
            email={user?.email}
            avatarUrl={userPreferences.avatarUrl}
            sidebarOpen={sidebarOpen}
            onSignOut={() => void handleSignOut()}
          />
        </div>
      </aside>

      <main className="relative flex-1 overflow-auto">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-primary/5 to-transparent" />
        <div key={`${currentWorkspace?.id ?? 'no-workspace'}:${location.pathname}`} className="alive-enter">
          <Outlet context={{ currentWorkspaceId: currentWorkspace?.id ?? null, currentWorkspace }} />
        </div>
      </main>
    </div>
  )
}
