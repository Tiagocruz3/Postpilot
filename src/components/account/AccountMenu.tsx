import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
  TrendingUp,
  UserRound,
  Zap,
} from 'lucide-react'
import { CreditMeter } from '@/components/account/CreditMeter'
import { TopUpCreditsModal } from '@/components/account/TopUpCreditsModal'
import { UsageHistoryModal } from '@/components/account/UsageHistoryModal'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCredits } from '@/contexts/CreditContext'
import { getInitials, getPreferredDisplayName, loadUserPreferences } from '@/lib/user-preferences'
import { cn } from '@/lib/utils'

type AccountMenuProps = {
  displayName: string
  email: string | undefined
  avatarUrl?: string | null
  sidebarOpen: boolean
  onSignOut: () => void
}

export function AccountMenu({ displayName, email, avatarUrl, sidebarOpen, onSignOut }: AccountMenuProps) {
  const navigate = useNavigate()
  const { balance, loading } = useCredits()
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)
  const userPreferences = loadUserPreferences()
  const resolvedName = getPreferredDisplayName(displayName, userPreferences)

  const roleLabel = balance.isAdmin ? 'Admin Account' : 'Member Account'
  const planLabel = balance.isAdmin ? 'Admin' : `${balance.planName} Plan`

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <button
            type="button"
            className={cn(
              'flex w-full items-center rounded-lg text-left transition-colors hover:bg-accent',
              sidebarOpen ? 'h-11 gap-3 px-2' : 'h-11 justify-center px-0',
            )}
            title={!sidebarOpen ? resolvedName : undefined}
          >
            <Avatar className="h-8 w-8 shrink-0">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt={resolvedName} /> : null}
              <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                {getInitials(resolvedName)}
              </AvatarFallback>
            </Avatar>
            <div
              className={cn(
                'min-w-0 flex-1 overflow-hidden transition-opacity duration-150',
                sidebarOpen ? 'opacity-100 delay-100' : 'pointer-events-none w-0 opacity-0',
              )}
            >
              <p className="truncate text-sm font-medium leading-tight">{resolvedName}</p>
              <p className="truncate text-[11px] text-muted-foreground leading-tight">
                {balance.isAdmin ? 'Unlimited credits' : `${balance.totalRemaining === Infinity ? '—' : balance.totalRemaining.toLocaleString()} credits`}
              </p>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-opacity duration-150',
                sidebarOpen ? 'opacity-100 delay-100' : 'opacity-0',
              )}
            />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="top" className="w-[min(100vw-1.5rem,20rem)] p-0">
          <div className="border-b px-3 py-3">
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={resolvedName} /> : null}
                <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">
                  {getInitials(resolvedName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{resolvedName}</p>
                <p className="truncate text-xs text-muted-foreground">{email ?? '—'}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-[10px] font-medium">
                    {planLabel}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {roleLabel}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="px-3 py-3">
            {!loading ? <CreditMeter balance={balance} /> : <p className="text-xs text-muted-foreground">Loading credits…</p>}
          </div>

          <div className="space-y-1 border-t px-2 py-2">
            {balance.isAdmin ? (
              <Button className="w-full justify-start" size="sm" onClick={() => navigate('/admin')}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Admin Panel
              </Button>
            ) : (
              <>
                <Button className="w-full justify-start" size="sm" onClick={() => setTopUpOpen(true)}>
                  <Zap className="mr-2 h-4 w-4" />
                  Top Up Credits
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/settings', { state: { tab: 'billing' } })}
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Upgrade Plan
                </Button>
              </>
            )}
          </div>

          <DropdownMenuSeparator className="mx-0" />

          <div className="px-1 pb-2">
            <DropdownMenuItem onClick={() => navigate('/settings', { state: { tab: 'profile' } })}>
              <UserRound className="mr-2 h-4 w-4" />
              Account Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings', { state: { tab: 'billing' } })}>
              <CreditCard className="mr-2 h-4 w-4" />
              Billing
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setUsageOpen(true)}>
              <History className="mr-2 h-4 w-4" />
              Usage History
            </DropdownMenuItem>
            {!balance.isAdmin ? (
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                App Settings
              </DropdownMenuItem>
            ) : null}
            {!balance.isAdmin ? (
              <DropdownMenuItem onClick={() => navigate('/settings', { state: { tab: 'growth-ads' } })}>
                <Sparkles className="mr-2 h-4 w-4" />
                Growth Ads Profile
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut} className="text-destructive hover:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <TopUpCreditsModal open={topUpOpen} onOpenChange={setTopUpOpen} />
      <UsageHistoryModal open={usageOpen} onOpenChange={setUsageOpen} email={email} />
    </>
  )
}
