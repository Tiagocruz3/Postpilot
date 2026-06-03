import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useWorkspaceIntegrations } from '@/hooks/useWorkspaceIntegrations'
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
  Menu,
  X,
} from 'lucide-react'
import { AccountMenu } from '@/components/account/AccountMenu'
import { AppLogo } from '@/components/AppLogo'
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
import { parseFacebookPages } from '@/lib/meta-integration-options'
import type { MetaPageOption } from '@/lib/meta-integration-options'

const SIDEBAR_TRANSITION = 'transition-[width,padding,margin] duration-200 ease-out'

export function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, loading: authLoading } = useAuth()
  const { workspaces, loading: workspacesLoading } = useWorkspaces(authLoading ? undefined : profile?.id)
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem('sidebar_open') !== 'false')
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
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

  // ── Facebook Page switcher ───────────────────────────────────────────────
  const { integrations } = useWorkspaceIntegrations(currentWorkspace?.id ?? null)

  const facebookIntegration = useMemo(
    () => integrations.find((i) => i.provider === 'facebook' || i.provider === 'meta') ?? null,
    [integrations],
  )

  const availablePages: MetaPageOption[] = useMemo(() => {
    const all = parseFacebookPages(facebookIntegration)
    const subset = facebookIntegration?.metadata?.workspace_page_ids as string[] | undefined
    return subset?.length ? all.filter((p) => subset.includes(p.id)) : all
  }, [facebookIntegration])

  const pageStorageKey = (wsId: string) => `current_page_id_${wsId}`

  const [selectedPageId, setSelectedPageId] = useState<string | null>(() => {
    const wsId = localStorage.getItem('current_workspace_id')
    return wsId ? localStorage.getItem(pageStorageKey(wsId)) : null
  })

  // When workspace changes, restore that workspace's saved page selection.
  useEffect(() => {
    if (currentWorkspace?.id) {
      setSelectedPageId(localStorage.getItem(pageStorageKey(currentWorkspace.id)))
    }
  }, [currentWorkspace?.id])

  // Auto-select first available page when pages load and selection is invalid.
  useEffect(() => {
    if (!availablePages.length) return
    if (availablePages.find((p) => p.id === selectedPageId)) return
    const first = availablePages[0]
    setSelectedPageId(first.id)
    if (currentWorkspace?.id) {
      localStorage.setItem(pageStorageKey(currentWorkspace.id), first.id)
    }
  }, [availablePages, selectedPageId, currentWorkspace?.id])

  const currentPage: MetaPageOption | null =
    availablePages.find((p) => p.id === selectedPageId) ?? availablePages[0] ?? null
  const currentPageId: string | null = currentPage?.id ?? null

  const handlePageChange = (id: string) => {
    setSelectedPageId(id)
    if (currentWorkspace?.id) {
      localStorage.setItem(pageStorageKey(currentWorkspace.id), id)
    }
  }

  useEffect(() => {
    localStorage.setItem('sidebar_open', String(sidebarOpen))
  }, [sidebarOpen])

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false)
  }, [location.pathname])

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

  // Block ALL rendering until both auth and workspace data are ready.
  // This eliminates the onboarding-card flash and layout shift on load/reload.
  if (authLoading || workspacesLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!authLoading && !workspacesLoading && workspaces.length === 0) {
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

  // Shared sidebar content (rendered inside desktop sidebar and mobile drawer)
  const SidebarContent = ({ compact }: { compact?: boolean }) => (
    <>
      {/* Logo + collapse toggle */}
      <div
        className={cn(
          'flex py-4',
          SIDEBAR_TRANSITION,
          compact ? 'flex-col items-center gap-3 px-2' : sidebarOpen ? 'items-center gap-2 px-4' : 'flex-col items-center gap-3 px-2'
        )}
      >
        {compact || !sidebarOpen ? (
          <AppLogo variant="icon" className="h-11 w-11 rounded-xl bg-primary p-2 shadow-sm" />
        ) : (
          <AppLogo variant="full" imgClassName="h-10" />
        )}
        {!compact && (
          <button
            type="button"
            onClick={() => setSidebarOpen((c) => !c)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Workspace selector */}
      {currentWorkspace && (
        <div className={cn('pb-2', SIDEBAR_TRANSITION, compact || !sidebarOpen ? 'px-2' : 'px-3')}>
          {!compact && sidebarOpen ? (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="outline" className="h-10 w-full justify-between rounded-lg px-3">
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
                    {ws.name}{ws.id === currentWorkspace.id ? ' · active' : ''}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/workspace-setup')}>New workspace</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : compact ? (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <button
                  type="button"
                  className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-input bg-muted/40 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title={`${currentWorkspace.name} — tap to switch`}
                >
                  <Building2 className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {workspaces.map((ws) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => handleWorkspaceChange(ws.id)}
                    className={cn(ws.id === currentWorkspace.id && 'bg-accent font-medium')}
                  >
                    {ws.name}{ws.id === currentWorkspace.id ? ' · active' : ''}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/workspace-setup')}>New workspace</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-input bg-muted/40 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={`${currentWorkspace.name} - expand to switch`}
            >
              <Building2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Facebook page switcher */}
      {currentPage && (
        <div className={cn('pb-2', SIDEBAR_TRANSITION, compact || !sidebarOpen ? 'px-2' : 'px-3')}>
          {!compact && sidebarOpen ? (
            availablePages.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="ghost" className="h-9 w-full justify-between rounded-lg px-3 text-left hover:bg-[#1877F2]/8">
                    <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#1877F2] text-[10px] font-bold text-white">f</span>
                      <span className="truncate text-sm">{currentPage.name}</span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  {availablePages.map((page) => (
                    <DropdownMenuItem
                      key={page.id}
                      onClick={() => handlePageChange(page.id)}
                      className={cn(page.id === currentPageId && 'bg-accent font-medium')}
                    >
                      {page.name}{page.id === currentPageId ? ' · active' : ''}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#1877F2] text-[10px] font-bold text-white">f</span>
                <span className="truncate">{currentPage.name}</span>
              </div>
            )
          ) : (
            <button
              type="button"
              onClick={() => !compact && setSidebarOpen(true)}
              className="mx-auto flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-[#1877F2]/10"
              title={currentPage.name}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded bg-[#1877F2] text-[10px] font-bold text-white">f</span>
            </button>
          )}
        </div>
      )}

      {/* Nav items */}
      <nav
        className={cn(
          'min-h-0 flex-1 space-y-0.5 overflow-y-auto py-2',
          SIDEBAR_TRANSITION,
          compact || !sidebarOpen ? 'px-2' : 'px-3'
        )}
      >
        {navItems.map((item) => {
          const active =
            location.pathname === item.path ||
            (item.path !== '/app' && location.pathname.startsWith(`${item.path}/`))
          const Icon = item.icon
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'group relative flex items-center rounded-lg text-sm font-medium transition-colors',
                compact || !sidebarOpen ? 'mx-auto h-10 w-10 justify-center' : 'h-10 w-full gap-3 px-3',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-foreground/80 hover:bg-accent hover:text-foreground'
              )}
              title={compact || !sidebarOpen ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!compact && sidebarOpen && <span className="flex-1 truncate text-left">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Account menu */}
      <div className={cn('border-t py-3', SIDEBAR_TRANSITION, compact || !sidebarOpen ? 'px-2' : 'px-3')}>
        <AccountMenu
          displayName={displayName}
          email={user?.email}
          avatarUrl={userPreferences.avatarUrl}
          sidebarOpen={compact ? false : sidebarOpen}
          onSignOut={() => void handleSignOut()}
        />
      </div>
    </>
  )

  return (
    <div className="flex h-screen w-full bg-background">

      {/* ── Mobile drawer overlay ─────────────────────────────────────────── */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r bg-card transition-transform duration-200 ease-out md:hidden',
          mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Navigation menu"
      >
        {/* Drawer close button */}
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(false)}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent />
      </aside>

      {/* ── Desktop sidebar ───────────────────────────────────────────────── */}
      <aside
        className={cn(
          'hidden md:flex min-h-0 shrink-0 flex-col border-r bg-card',
          SIDEBAR_TRANSITION,
          sidebarOpen ? 'w-64' : 'w-16'
        )}
        aria-label="Navigation"
      >
        <SidebarContent />
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <AppLogo variant="full" imgClassName="h-9" />
        </header>

        <main className="relative flex-1 overflow-auto pb-16 md:pb-0">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-primary/5 to-transparent" />
          <div key={`${currentWorkspace?.id ?? 'no-workspace'}:${currentPageId ?? 'no-page'}:${location.pathname}`} className="alive-enter">
            <Outlet context={{ currentWorkspaceId: currentWorkspace?.id ?? null, currentWorkspace, currentPageId, currentPage }} />
          </div>
        </main>

        {/* Mobile bottom navigation bar */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t bg-card/95 backdrop-blur-sm md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          aria-label="Bottom navigation"
        >
          {navItems.slice(0, 5).map((item) => {
            const active =
              location.pathname === item.path ||
              (item.path !== '/app' && location.pathname.startsWith(`${item.path}/`))
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={cn('h-5 w-5', active && 'stroke-[2.2]')} />
                <span className="truncate">{item.label.split(' ').slice(-1)[0]}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
