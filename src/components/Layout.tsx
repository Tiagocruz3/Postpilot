import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Bot,
  PenTool,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  CalendarDays,
  Building2,
  Sparkles,
  LayoutDashboard,
  Menu,
  ChevronLeft,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isDemoMode } from '@/lib/demo'
import { getInitials, getPreferredDisplayName, loadUserPreferences } from '@/lib/user-preferences'

export function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()
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
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, hint: 'Overview + quick actions' },
    { path: '/planner', label: 'Planner', icon: CalendarDays, hint: 'Calendar + Google sync' },
    { path: '/compose', label: 'Compose', icon: PenTool, hint: 'Facebook, LinkedIn, X' },
    { path: '/ads', label: 'Ads', icon: BarChart3, hint: 'Meta AI ad studio' },
    { path: '/settings', label: 'Settings', icon: Settings },
  ]
  const userPreferences = loadUserPreferences()
  const displayName = getPreferredDisplayName(profile?.display_name, userPreferences)

  if (!loading && workspaces.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-xl rounded-3xl border bg-card p-8 shadow-sm">
          <div className="mb-5 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Workspace bootstrap
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Create your first PostPilot workspace</h1>
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
              <p className="mt-3 text-sm font-medium">Planner-ready from day one</p>
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
          'flex flex-col overflow-hidden border-r bg-card transition-[width] duration-300 ease-out',
          sidebarOpen ? 'w-72' : 'w-24'
        )}
      >
        <div className="flex items-center justify-between px-4 py-5">
          <div className="flex min-w-0 items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-sm">
              P
            </div>
            <div
              className={cn(
                'min-w-0 overflow-hidden transition-all duration-200 ease-out',
                sidebarOpen ? 'max-w-[180px] translate-x-0 opacity-100' : 'max-w-0 -translate-x-2 opacity-0'
              )}
            >
              <div>
                <span className="block text-lg font-bold tracking-tight text-navy-900">PostPilot</span>
                <span className="text-xs text-muted-foreground">Social + ads scheduler</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen((current) => !current)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        <div className="px-4 py-2">
          {currentWorkspace && (
            sidebarOpen ? (
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button
                    variant="outline"
                    className="h-12 w-full justify-between rounded-2xl px-4 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Building2 className="h-4 w-4 shrink-0" />
                      <div className="min-w-0 text-left transition-all duration-200">
                        <div className="truncate text-sm font-medium">{currentWorkspace.name}</div>
                        <div className="text-xs text-muted-foreground">Workspace active</div>
                      </div>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50 transition-all duration-200" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {workspaces.map((ws) => (
                    <DropdownMenuItem key={ws.id} onClick={() => handleWorkspaceChange(ws.id)}>
                      {ws.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/workspace-setup')}>New workspace</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-input bg-muted/40 text-muted-foreground"
                title={currentWorkspace.name}
                aria-hidden="true"
              >
                <Building2 className="h-4 w-4" />
              </div>
            )
          )}
        </div>

        <div className="px-4 pb-2 pt-4">
          <div
            className={cn(
              'rounded-2xl bg-primary/8 transition-all duration-200',
              sidebarOpen ? 'p-4' : 'mx-auto flex h-12 w-12 items-center justify-center p-0'
            )}
            title={!sidebarOpen ? 'Build order' : undefined}
          >
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Bot className="h-4 w-4 shrink-0 text-primary" />
              <div
                className={cn(
                  'overflow-hidden transition-all duration-200',
                  sidebarOpen ? 'max-w-[160px] opacity-100' : 'max-w-0 opacity-0'
                )}
              >
                Build order
              </div>
            </div>
            <p
              className={cn(
                'text-xs leading-5 text-muted-foreground transition-all duration-200',
                sidebarOpen ? 'mt-2 max-h-20 opacity-100' : 'max-h-0 opacity-0'
              )}
            >
              Auth and workspace bootstrap first, then the planner, post composers, ads module, and scheduler automation.
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const active = location.pathname === item.path
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  sidebarOpen ? 'gap-3' : 'justify-center gap-0',
                  active ? 'bg-primary text-primary-foreground' : 'text-navy-700 hover:bg-accent'
                )}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div
                  className={cn(
                    'min-w-0 overflow-hidden text-left transition-all duration-200',
                    sidebarOpen ? 'max-w-[160px] opacity-100' : 'max-w-0 opacity-0'
                  )}
                >
                  <div className="min-w-0 text-left">
                    <div>{item.label}</div>
                    {'hint' in item && item.hint ? (
                      <div className={cn('truncate text-xs', active ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                        {item.hint}
                      </div>
                    ) : null}
                  </div>
                </div>
              </button>
            )
          })}
        </nav>

        <div className="border-t p-4">
          <div className={cn('flex items-center', sidebarOpen ? 'gap-3' : 'justify-center')}>
            <Avatar className="h-8 w-8">
              {userPreferences.avatarUrl ? <AvatarImage src={userPreferences.avatarUrl} alt={displayName} /> : null}
              <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div
              className={cn(
                'flex-1 overflow-hidden transition-all duration-200',
                sidebarOpen ? 'max-w-[120px] opacity-100' : 'max-w-0 opacity-0'
              )}
            >
              <p className="truncate text-sm font-medium">{displayName}</p>
            </div>
            <button
              onClick={async () => {
                if (isDemoMode) {
                  navigate('/login')
                  return
                }
                await supabase.auth.signOut()
                navigate('/login')
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="relative flex-1 overflow-auto">
        <Outlet context={{ currentWorkspaceId: currentWorkspace?.id ?? null, currentWorkspace }} />
      </main>
    </div>
  )
}
