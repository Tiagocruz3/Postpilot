import { useEffect, useMemo, useState } from 'react'
import { useLocation, useOutletContext } from 'react-router-dom'
import {
  UserRound,
  Bot,
  Image as ImageIcon,
  Link,
  MonitorSmartphone,
  Globe2,
  RefreshCcw,
  Trash2,
  Video,
} from 'lucide-react'
import { WorkspaceTeamCard } from '@/components/WorkspaceTeamCard'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/useAuth'
import { redirectToEdgeFunction, supabase } from '@/lib/supabase'
import { isDemoMode } from '@/lib/demo'
import {
  DEFAULT_FAL_VIDEO_MODELS,
  type AiSettings,
  type ContentAiProvider,
  type LmStudioModelOption,
  type OpenRouterModelOption,
  loadAiSettings,
  saveAiSettings,
} from '@/lib/ai-settings'
import { IntegrationProvider, UserIntegration } from '@/types'
import {
  formatUserDateTime,
  getInitials,
  getPreferredDisplayName,
  loadUserPreferences,
  profileToUserPreferences,
  saveUserPreferences,
  type UserPreferences,
} from '@/lib/user-preferences'
import type { Database } from '@/types/database'

interface OutletContext {
  currentWorkspaceId: string | null
  currentWorkspace: { id: string; name: string; owner_id: string } | null
}

type SettingsTab =
  | 'profile'
  | 'regional'
  | 'team'
  | 'accounts'
  | 'content-ai'
  | 'image-ai'
  | 'video-ai'
  | 'local-ai'
type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
type WorkspaceAiSettingsRow = Database['public']['Tables']['workspace_ai_settings']['Row']
type WorkspaceAiSettingsInsert = Database['public']['Tables']['workspace_ai_settings']['Insert']

interface OpenRouterModelsResponse {
  data?: OpenRouterModelOption[]
}

interface LmStudioModelsResponse {
  data?: LmStudioModelOption[]
}

const commonTimeZones = [
  'UTC',
  'Australia/Brisbane',
  'Australia/Sydney',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Singapore',
  'Asia/Tokyo',
]

function makeDemoIntegrations(): UserIntegration[] {
  const timestamp = new Date().toISOString()
  return [
    {
      id: '1',
      user_id: 'demo-user-id',
      workspace_id: 'demo-ws-1',
      provider: 'facebook',
      access_token_encrypted: '',
      token_iv: '',
      refresh_token_encrypted: null,
      expires_at: null,
      metadata: {},
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      id: '2',
      user_id: 'demo-user-id',
      workspace_id: 'demo-ws-1',
      provider: 'linkedin',
      access_token_encrypted: '',
      token_iv: '',
      refresh_token_encrypted: null,
      expires_at: null,
      metadata: {},
      created_at: timestamp,
      updated_at: timestamp,
    },
  ]
}

export function SettingsPage() {
  const location = useLocation()
  const { currentWorkspaceId, currentWorkspace } = useOutletContext<OutletContext>()
  const { user, profile } = useAuth()
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const tab = (location.state as { tab?: SettingsTab } | null)?.tab
    return tab ?? 'profile'
  })
  const [integrations, setIntegrations] = useState<UserIntegration[]>(isDemoMode ? makeDemoIntegrations() : [])
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => loadAiSettings())
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(() => loadUserPreferences())
  const [openRouterTextModels, setOpenRouterTextModels] = useState<OpenRouterModelOption[]>([])
  const [openRouterImageModels, setOpenRouterImageModels] = useState<OpenRouterModelOption[]>([])
  const [lmStudioModels, setLmStudioModels] = useState<LmStudioModelOption[]>([])
  const [openRouterTextQuery, setOpenRouterTextQuery] = useState('')
  const [openRouterImageQuery, setOpenRouterImageQuery] = useState('')
  const [lmStudioQuery, setLmStudioQuery] = useState('')
  const [openRouterTextMenuOpen, setOpenRouterTextMenuOpen] = useState(false)
  const [openRouterImageMenuOpen, setOpenRouterImageMenuOpen] = useState(false)
  const [lmStudioMenuOpen, setLmStudioMenuOpen] = useState(false)
  const [openRouterTextLoading, setOpenRouterTextLoading] = useState(false)
  const [openRouterImageLoading, setOpenRouterImageLoading] = useState(false)
  const [lmStudioLoading, setLmStudioLoading] = useState(false)
  const [workspaceAiSettingsSaving, setWorkspaceAiSettingsSaving] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState('')

  useEffect(() => {
    const tab = (location.state as { tab?: SettingsTab } | null)?.tab
    if (tab) {
      setActiveTab(tab)
    }
  }, [location.state])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const oauthError = params.get('oauth_error')
    if (oauthError) {
      setSettingsMessage(oauthError)
      setActiveTab('accounts')
      window.history.replaceState({}, '', location.pathname)
      return
    }

    if (params.get('oauth') === 'facebook' && params.get('status') === 'connected') {
      setSettingsMessage('Facebook connected successfully.')
      setActiveTab('accounts')
      window.history.replaceState({}, '', location.pathname)
      if (!isDemoMode && currentWorkspaceId) {
        void supabase
          .from('user_integrations')
          .select('*')
          .eq('workspace_id', currentWorkspaceId)
          .then(({ data }) => setIntegrations((data as UserIntegration[]) ?? []))
      }
    }
  }, [location.search, location.pathname, currentWorkspaceId])

  useEffect(() => {
    saveAiSettings(aiSettings)
  }, [aiSettings])

  useEffect(() => {
    saveUserPreferences(userPreferences)
  }, [userPreferences])

  useEffect(() => {
    if (!profile) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      setUserPreferences((current) => profileToUserPreferences(profile, current))
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [profile])

  useEffect(() => {
    if (isDemoMode) {
      return
    }

    let active = true

    async function loadIntegrations() {
      if (!currentWorkspaceId) {
        if (active) {
          setIntegrations([])
        }
        return
      }

      const { data } = await supabase.from('user_integrations').select('*').eq('workspace_id', currentWorkspaceId)

      if (active) {
        setIntegrations((data as UserIntegration[]) ?? [])
      }
    }

    void loadIntegrations()

    return () => {
      active = false
    }
  }, [currentWorkspaceId])

  useEffect(() => {
    if (isDemoMode) {
      return
    }

    let active = true

    async function loadWorkspaceAiSettings() {
      if (!currentWorkspaceId) {
        return
      }

      const { data, error } = await supabase
        .from('workspace_ai_settings')
        .select('*')
        .eq('workspace_id', currentWorkspaceId)
        .maybeSingle()

      if (!active) {
        return
      }

      if (error) {
        setSettingsMessage(error.message)
        return
      }

      const workspaceSettings = data as WorkspaceAiSettingsRow | null
      if (workspaceSettings) {
        setAiSettings((current) => ({
          ...current,
          contentProvider: workspaceSettings.content_provider,
          openRouterContentModel: workspaceSettings.openrouter_content_model ?? current.openRouterContentModel,
          openRouterImageModel: workspaceSettings.openrouter_image_model ?? current.openRouterImageModel,
          falVideoModel: workspaceSettings.fal_video_model ?? current.falVideoModel,
          lmStudioBaseUrl: workspaceSettings.lmstudio_base_url || current.lmStudioBaseUrl,
          lmStudioContentModel: workspaceSettings.lmstudio_content_model ?? current.lmStudioContentModel,
        }))
      }

    }

    void loadWorkspaceAiSettings()

    return () => {
      active = false
    }
  }, [currentWorkspaceId])

  const providers: Array<{ key: IntegrationProvider; oauthKey: string; name: string }> = [
    { key: 'facebook', oauthKey: 'facebook', name: 'Facebook Pages' },
    { key: 'linkedin', oauthKey: 'linkedin', name: 'LinkedIn' },
    { key: 'x', oauthKey: 'x', name: 'X (Twitter)' },
    { key: 'meta', oauthKey: 'meta', name: 'Meta Ads' },
    { key: 'google', oauthKey: 'google-calendar', name: 'Google Calendar' },
  ]

  const selectedFalVideo = useMemo(
    () => DEFAULT_FAL_VIDEO_MODELS.find((model) => model.id === aiSettings.falVideoModel),
    [aiSettings.falVideoModel]
  )
  const filteredOpenRouterTextModels = useMemo(() => {
    const query = openRouterTextQuery.trim().toLowerCase()
    if (!query) return openRouterTextModels
    return openRouterTextModels.filter((model) =>
      `${model.name ?? ''} ${model.id}`.toLowerCase().includes(query)
    )
  }, [openRouterTextModels, openRouterTextQuery])
  const filteredOpenRouterImageModels = useMemo(() => {
    const query = openRouterImageQuery.trim().toLowerCase()
    if (!query) return openRouterImageModels
    return openRouterImageModels.filter((model) =>
      `${model.name ?? ''} ${model.id}`.toLowerCase().includes(query)
    )
  }, [openRouterImageModels, openRouterImageQuery])
  const filteredLmStudioModels = useMemo(() => {
    const query = lmStudioQuery.trim().toLowerCase()
    if (!query) return lmStudioModels
    return lmStudioModels.filter((model) => model.id.toLowerCase().includes(query))
  }, [lmStudioModels, lmStudioQuery])
  const displayName = getPreferredDisplayName(profile?.display_name, userPreferences)
  const regionalPreview = formatUserDateTime(new Date(), userPreferences)
  const timeZoneOptions = useMemo(
    () => Array.from(new Set([userPreferences.timeZone, ...commonTimeZones])),
    [userPreferences.timeZone]
  )

  const disconnect = async (id: string) => {
    if (isDemoMode) {
      setIntegrations((prev) => prev.filter((integration) => integration.id !== id))
      return
    }

    await supabase.from('user_integrations').delete().eq('id', id)
    setIntegrations((prev) => prev.filter((integration) => integration.id !== id))
  }

  const connect = (provider: string, integrationProvider: IntegrationProvider) => {
    if (isDemoMode) {
      setIntegrations((prev) => [
        ...prev,
        {
          id: `${Date.now()}`,
          user_id: 'demo-user-id',
          workspace_id: currentWorkspaceId ?? 'demo-ws-1',
          provider: integrationProvider,
          access_token_encrypted: '',
          token_iv: '',
          refresh_token_encrypted: null,
          expires_at: null,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      return
    }

    void redirectToEdgeFunction(`${provider}-oauth-start`, { workspace_id: currentWorkspaceId })
  }

  const saveProfileSettings = async () => {
    setSettingsMessage('')

    if (isDemoMode) {
      setSettingsMessage('Profile settings saved locally in demo mode.')
      return
    }

    if (!user) {
      setSettingsMessage('You need to be signed in to save profile settings.')
      return
    }

    const profileUpdate: ProfileUpdate = {
      display_name: userPreferences.displayName || profile?.display_name || null,
      avatar_url: userPreferences.avatarUrl || null,
      locale: userPreferences.locale,
      time_zone: userPreferences.timeZone,
      date_style: userPreferences.dateStyle,
      time_format: userPreferences.timeFormat,
    }

    const { error } = await supabase
      .from('profiles')
      .update(profileUpdate as never)
      .eq('id', user.id)

    if (error) {
      setSettingsMessage(error.message)
      return
    }

    setSettingsMessage('Profile and regional settings saved.')
  }

  const saveWorkspaceAiSettings = async () => {
    setSettingsMessage('')

    if (isDemoMode) {
      setSettingsMessage('AI settings saved locally in demo mode.')
      return
    }

    if (!user || !currentWorkspaceId) {
      setSettingsMessage('Choose a workspace and sign in before saving AI settings.')
      return
    }

    setWorkspaceAiSettingsSaving(true)

    const payload: WorkspaceAiSettingsInsert = {
      workspace_id: currentWorkspaceId,
      updated_by: user.id,
      content_provider: aiSettings.contentProvider,
      openrouter_content_model: aiSettings.openRouterContentModel || null,
      openrouter_image_model: aiSettings.openRouterImageModel || null,
      fal_video_model: aiSettings.falVideoModel || null,
      lmstudio_base_url: aiSettings.lmStudioBaseUrl || 'http://127.0.0.1:1234/v1',
      lmstudio_content_model: aiSettings.lmStudioContentModel || null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('workspace_ai_settings')
      .upsert(payload as never, { onConflict: 'workspace_id' })

    setWorkspaceAiSettingsSaving(false)

    if (error) {
      setSettingsMessage(error.message)
      return
    }

    setSettingsMessage('Workspace AI settings saved. API keys are provided by the platform owner.')
  }

  async function fetchOpenRouterModels(mode: 'text' | 'image') {
    if (mode === 'text') {
      setOpenRouterTextLoading(true)
    } else {
      setOpenRouterImageLoading(true)
    }

    setSettingsMessage('')

    try {
      const { data, error } = await supabase.functions.invoke('openrouter-models', {
        body: { mode },
      })

      if (error) {
        throw new Error(error.message)
      }

      const payload = data as OpenRouterModelsResponse
      if (!payload?.data) {
        throw new Error('OpenRouter is not configured. Ask your platform administrator.')
      }
      const models = (payload.data ?? []).sort((left, right) => {
        const leftName = left.name ?? left.id
        const rightName = right.name ?? right.id
        return leftName.localeCompare(rightName)
      })

      if (mode === 'text') {
        setOpenRouterTextModels(models)
        setAiSettings((current) => ({
          ...current,
          openRouterContentModel: current.openRouterContentModel || models[0]?.id || '',
        }))
      } else {
        setOpenRouterImageModels(models)
        setAiSettings((current) => ({
          ...current,
          openRouterImageModel: current.openRouterImageModel || models[0]?.id || '',
        }))
      }

      setSettingsMessage(`Loaded ${models.length} live ${mode} model${models.length === 1 ? '' : 's'} from OpenRouter.`)
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Failed to load OpenRouter models.')
    } finally {
      if (mode === 'text') {
        setOpenRouterTextLoading(false)
      } else {
        setOpenRouterImageLoading(false)
      }
    }
  }

  async function fetchLmStudioModels() {
    setLmStudioLoading(true)
    setSettingsMessage('')

    try {
      const baseUrl = aiSettings.lmStudioBaseUrl.replace(/\/$/, '')
      const response = await fetch(`${baseUrl}/models`)
      if (!response.ok) {
        throw new Error(`LM Studio returned ${response.status}`)
      }

      const payload = (await response.json()) as LmStudioModelsResponse
      const models = (payload.data ?? []).sort((left, right) => left.id.localeCompare(right.id))
      setLmStudioModels(models)
      setAiSettings((current) => ({
        ...current,
        lmStudioContentModel: current.lmStudioContentModel || models[0]?.id || '',
      }))
      setSettingsMessage(`Loaded ${models.length} installed model${models.length === 1 ? '' : 's'} from LM Studio.`)
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Failed to load LM Studio models.')
    } finally {
      setLmStudioLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Connect social accounts, choose AI models for your workspace, and manage profile preferences. API keys for
          OpenRouter, Lovable, and fal are configured by the platform owner—not individual subscribers.
        </p>
      </div>

      <div
        className={`mb-4 min-h-[3.25rem] rounded-2xl border px-4 py-3 text-sm transition-colors ${
          settingsMessage
            ? 'border-border bg-primary/5 text-foreground'
            : 'border-transparent bg-transparent text-transparent'
        }`}
        aria-live="polite"
      >
        {settingsMessage || 'status'}
      </div>

      <Tabs>
        <TabsList className="mb-6 h-auto flex-wrap justify-start gap-1 rounded-2xl p-1">
          <TabsTrigger value="profile" activeValue={activeTab} onClick={(value) => setActiveTab(value as SettingsTab)}>
            Profile
          </TabsTrigger>
          <TabsTrigger value="regional" activeValue={activeTab} onClick={(value) => setActiveTab(value as SettingsTab)}>
            Regional
          </TabsTrigger>
          <TabsTrigger value="team" activeValue={activeTab} onClick={(value) => setActiveTab(value as SettingsTab)}>
            Team
          </TabsTrigger>
          <TabsTrigger value="accounts" activeValue={activeTab} onClick={(value) => setActiveTab(value as SettingsTab)}>
            Accounts
          </TabsTrigger>
          <TabsTrigger value="content-ai" activeValue={activeTab} onClick={(value) => setActiveTab(value as SettingsTab)}>
            Content AI
          </TabsTrigger>
          <TabsTrigger value="image-ai" activeValue={activeTab} onClick={(value) => setActiveTab(value as SettingsTab)}>
            Image AI
          </TabsTrigger>
          <TabsTrigger value="video-ai" activeValue={activeTab} onClick={(value) => setActiveTab(value as SettingsTab)}>
            Video AI
          </TabsTrigger>
          <TabsTrigger value="local-ai" activeValue={activeTab} onClick={(value) => setActiveTab(value as SettingsTab)}>
            Local AI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" activeValue={activeTab}>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="h-5 w-5 text-primary" />
                  User profile
                </CardTitle>
                <CardDescription>
                  Update the display name and avatar used across the dashboard, sidebar, and settings experience.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-2">
                  <Label htmlFor="profile-display-name">Display name</Label>
                  <Input
                    id="profile-display-name"
                    value={userPreferences.displayName}
                    onChange={(event) =>
                      setUserPreferences((current) => ({
                        ...current,
                        displayName: event.target.value,
                      }))
                    }
                    placeholder={profile?.display_name || 'Your name'}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="profile-avatar-url">Avatar URL</Label>
                  <Input
                    id="profile-avatar-url"
                    value={userPreferences.avatarUrl}
                    onChange={(event) =>
                      setUserPreferences((current) => ({
                        ...current,
                        avatarUrl: event.target.value,
                      }))
                    }
                    placeholder="https://example.com/avatar.png"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="profile-email">Email</Label>
                  <Input id="profile-email" value={user?.email ?? 'demo@postpilot.app'} disabled />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => void saveProfileSettings()}>Save profile</Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setUserPreferences((current) => ({
                        ...current,
                        displayName: profile?.display_name || '',
                        avatarUrl: profile?.avatar_url || '',
                      }))
                    }
                  >
                    Reset from account
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Profile preview</CardTitle>
                <CardDescription>How your identity appears around the workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 rounded-2xl border bg-muted/30 p-4">
                  <Avatar className="h-14 w-14">
                    {userPreferences.avatarUrl ? <AvatarImage src={userPreferences.avatarUrl} alt={displayName} /> : null}
                    <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">{displayName}</p>
                    <p className="text-xs text-muted-foreground">{user?.email ?? 'demo@postpilot.app'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="regional" activeValue={activeTab}>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe2 className="h-5 w-5 text-primary" />
                  Local date and time
                </CardTitle>
                <CardDescription>
                  Choose the locale, timezone, and date/time style used on the dashboard and other summaries.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="regional-locale">Locale</Label>
                    <Input
                      id="regional-locale"
                      value={userPreferences.locale}
                      onChange={(event) =>
                        setUserPreferences((current) => ({
                          ...current,
                          locale: event.target.value,
                        }))
                      }
                      placeholder="en-AU"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="regional-timezone">Timezone</Label>
                    <Select
                      id="regional-timezone"
                      value={userPreferences.timeZone}
                      onChange={(event) =>
                        setUserPreferences((current) => ({
                          ...current,
                          timeZone: event.target.value,
                        }))
                      }
                    >
                      {timeZoneOptions.map((timeZone) => (
                        <option key={timeZone} value={timeZone}>
                          {timeZone}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="regional-date-style">Date style</Label>
                    <Select
                      id="regional-date-style"
                      value={userPreferences.dateStyle}
                      onChange={(event) =>
                        setUserPreferences((current) => ({
                          ...current,
                          dateStyle: event.target.value as UserPreferences['dateStyle'],
                        }))
                      }
                    >
                      <option value="short">Short</option>
                      <option value="medium">Medium</option>
                      <option value="long">Long</option>
                      <option value="full">Full</option>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="regional-time-format">Time format</Label>
                    <Select
                      id="regional-time-format"
                      value={userPreferences.timeFormat}
                      onChange={(event) =>
                        setUserPreferences((current) => ({
                          ...current,
                          timeFormat: event.target.value as UserPreferences['timeFormat'],
                        }))
                      }
                    >
                      <option value="12h">12 hour</option>
                      <option value="24h">24 hour</option>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => void saveProfileSettings()}>Save regional settings</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Regional preview</CardTitle>
                <CardDescription>This is how time will appear on the dashboard.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-foreground">{regionalPreview}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{userPreferences.timeZone}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="team" activeValue={activeTab}>
          <WorkspaceTeamCard
            workspaceId={currentWorkspaceId}
            workspaceName={currentWorkspace?.name}
            currentUserId={user?.id}
            isWorkspaceOwner={currentWorkspace?.owner_id === user?.id}
          />
        </TabsContent>

        <TabsContent value="accounts" activeValue={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle>Connected accounts</CardTitle>
              <CardDescription>Manage social, ads, and calendar connections for the current workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {providers.map((provider) => {
                const connected = integrations.find((integration) => integration.provider === provider.key)
                return (
                  <div key={provider.key} className="flex items-center justify-between rounded-xl border p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                        {provider.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{provider.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {connected ? `Connected ${new Date(connected.created_at).toLocaleDateString()}` : 'Not connected'}
                        </p>
                      </div>
                    </div>
                    {connected ? (
                      <Button size="sm" variant="destructive" onClick={() => disconnect(connected.id)}>
                        <Trash2 className="mr-2 h-3 w-3" />
                        Disconnect
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => connect(provider.oauthKey, provider.key)}>
                        <Link className="mr-2 h-3 w-3" />
                        Connect
                      </Button>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content-ai" activeValue={activeTab}>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  Content generation provider
                </CardTitle>
                <CardDescription>
                  Choose whether social copy runs through OpenRouter (platform-provided) or a local LM Studio instance.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-2xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  OpenRouter credentials are supplied by the platform owner via server environment variables.
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="content-provider">Provider</Label>
                  <Select
                    id="content-provider"
                    value={aiSettings.contentProvider}
                    onChange={(event) =>
                      setAiSettings((current) => ({
                        ...current,
                        contentProvider: event.target.value as ContentAiProvider,
                      }))
                    }
                  >
                    <option value="openrouter">OpenRouter</option>
                    <option value="lmstudio">LM Studio</option>
                  </Select>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={() => void fetchOpenRouterModels('text')} disabled={openRouterTextLoading}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    {openRouterTextLoading ? 'Loading models...' : 'Load real OpenRouter models'}
                  </Button>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="openrouter-content-model">OpenRouter content model</Label>
                  <Input
                    id="openrouter-content-model"
                    value={aiSettings.openRouterContentModel}
                    placeholder="Selected model id"
                    onChange={(event) =>
                      setAiSettings((current) => ({
                        ...current,
                        openRouterContentModel: event.target.value,
                      }))
                    }
                  />
                  <Input
                    value={openRouterTextQuery}
                    onChange={(event) => setOpenRouterTextQuery(event.target.value)}
                    placeholder="Search models..."
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => setOpenRouterTextMenuOpen((value) => !value)}>
                    {openRouterTextMenuOpen ? 'Close model list' : 'Open model list'}
                  </Button>
                  {openRouterTextMenuOpen ? (
                    <div
                      className="max-h-56 overflow-y-auto overscroll-contain rounded-lg border bg-muted/20 p-1"
                      onWheel={(event) => event.stopPropagation()}
                    >
                      {filteredOpenRouterTextModels.length ? (
                        filteredOpenRouterTextModels.map((model) => (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => {
                              setAiSettings((current) => ({
                                ...current,
                                openRouterContentModel: model.id,
                              }))
                              setOpenRouterTextMenuOpen(false)
                            }}
                            className={`w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${
                              aiSettings.openRouterContentModel === model.id ? 'bg-primary/10 text-primary' : ''
                            }`}
                            title={model.id}
                          >
                            {model.name ?? model.id}
                          </button>
                        ))
                      ) : (
                        <p className="px-2 py-1.5 text-xs text-muted-foreground">No matching models.</p>
                      )}
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">All models stay inside this scrollable list.</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void saveWorkspaceAiSettings()} disabled={workspaceAiSettingsSaving || !currentWorkspaceId}>
                    {workspaceAiSettingsSaving ? 'Saving AI settings...' : 'Save AI settings'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active content mode</CardTitle>
                <CardDescription>Current copy generation route for posts and ads.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="rounded-2xl border bg-muted/30 p-4">
                  <p className="font-medium text-foreground">
                    {aiSettings.contentProvider === 'openrouter' ? 'OpenRouter selected' : 'LM Studio selected'}
                  </p>
                  <p className="mt-2">
                    {aiSettings.contentProvider === 'openrouter'
                      ? aiSettings.openRouterContentModel || 'Pick a live OpenRouter model from the list.'
                      : aiSettings.lmStudioContentModel || 'Pick a local LM Studio model in the Local AI tab.'}
                  </p>
                </div>
                <div className="rounded-2xl border bg-muted/30 p-4">
                  <p className="font-medium text-foreground">Storage</p>
                  <p className="mt-2">
                    Model and provider choices are saved per workspace. Shared API keys never leave the server.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="image-ai" activeValue={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                Default image model
              </CardTitle>
              <CardDescription>
                Choose the default image model for post and ad visuals. The platform owner&apos;s OpenRouter key is used
                server-side.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => void fetchOpenRouterModels('image')} disabled={openRouterImageLoading}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  {openRouterImageLoading ? 'Loading image models...' : 'Load real image models'}
                </Button>
              </div>

              <div className="grid gap-2 md:max-w-2xl">
                <Label htmlFor="openrouter-image-model">Default OpenRouter image model</Label>
                <Input
                  id="openrouter-image-model"
                  value={aiSettings.openRouterImageModel}
                  placeholder="Selected image model id"
                  onChange={(event) =>
                    setAiSettings((current) => ({
                      ...current,
                      openRouterImageModel: event.target.value,
                    }))
                  }
                />
                <Input
                  value={openRouterImageQuery}
                  onChange={(event) => setOpenRouterImageQuery(event.target.value)}
                  placeholder="Search image models..."
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setOpenRouterImageMenuOpen((value) => !value)}>
                  {openRouterImageMenuOpen ? 'Close image model list' : 'Open image model list'}
                </Button>
                {openRouterImageMenuOpen ? (
                  <div
                    className="max-h-56 overflow-y-auto overscroll-contain rounded-lg border bg-muted/20 p-1"
                    onWheel={(event) => event.stopPropagation()}
                  >
                    {filteredOpenRouterImageModels.length ? (
                      filteredOpenRouterImageModels.map((model) => (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => {
                            setAiSettings((current) => ({
                              ...current,
                              openRouterImageModel: model.id,
                            }))
                            setOpenRouterImageMenuOpen(false)
                          }}
                          className={`w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${
                            aiSettings.openRouterImageModel === model.id ? 'bg-primary/10 text-primary' : ''
                          }`}
                          title={model.id}
                        >
                          {model.name ?? model.id}
                        </button>
                      ))
                    ) : (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">No matching image models.</p>
                    )}
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">All image models stay inside this scrollable list.</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => void saveWorkspaceAiSettings()} disabled={workspaceAiSettingsSaving || !currentWorkspaceId}>
                  {workspaceAiSettingsSaving ? 'Saving AI settings...' : 'Save AI settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="video-ai" activeValue={activeTab}>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary" />
                  fal video generation
                </CardTitle>
                <CardDescription>
                  Choose the default video endpoint for future social/video workflows. The fal API key is provided by the
                  platform owner.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-2xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  fal credentials are configured in the platform deployment environment, not in subscriber settings.
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="fal-video-model">Default fal video model</Label>
                  <Select
                    id="fal-video-model"
                    value={aiSettings.falVideoModel}
                    onChange={(event) =>
                      setAiSettings((current) => ({
                        ...current,
                        falVideoModel: event.target.value,
                      }))
                    }
                  >
                    {DEFAULT_FAL_VIDEO_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="fal-custom-model">Custom fal endpoint override</Label>
                  <Input
                    id="fal-custom-model"
                    value={aiSettings.falVideoModel}
                    onChange={(event) =>
                      setAiSettings((current) => ({
                        ...current,
                        falVideoModel: event.target.value,
                      }))
                    }
                    placeholder="fal-ai/your-endpoint"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void saveWorkspaceAiSettings()} disabled={workspaceAiSettingsSaving || !currentWorkspaceId}>
                    {workspaceAiSettingsSaving ? 'Saving AI settings...' : 'Save AI settings'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Selected video endpoint</CardTitle>
                <CardDescription>Current default for video generation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="rounded-2xl border bg-muted/30 p-4">
                  <p className="font-medium text-foreground">{selectedFalVideo?.label ?? 'Custom fal model'}</p>
                  <p className="mt-2">{aiSettings.falVideoModel}</p>
                </div>
                <div className="rounded-2xl border bg-muted/30 p-4">
                  <p className="font-medium text-foreground">Why this tab exists</p>
                  <p className="mt-2">This keeps video generation separate from text and image model choices so you can swap video providers cleanly.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="local-ai" activeValue={activeTab}>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MonitorSmartphone className="h-5 w-5 text-primary" />
                  LM Studio
                </CardTitle>
                <CardDescription>
                  Use a local LM Studio model instead of OpenRouter for general content generation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-2">
                  <Label htmlFor="lmstudio-base-url">LM Studio base URL</Label>
                  <Input
                    id="lmstudio-base-url"
                    value={aiSettings.lmStudioBaseUrl}
                    onChange={(event) =>
                      setAiSettings((current) => ({
                        ...current,
                        lmStudioBaseUrl: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={() => void fetchLmStudioModels()} disabled={lmStudioLoading}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    {lmStudioLoading ? 'Loading local models...' : 'Load LM Studio models'}
                  </Button>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="lmstudio-model">Local content model</Label>
                  <Input
                    id="lmstudio-model"
                    value={aiSettings.lmStudioContentModel}
                    placeholder="Selected local model id"
                    onChange={(event) =>
                      setAiSettings((current) => ({
                        ...current,
                        lmStudioContentModel: event.target.value,
                      }))
                    }
                  />
                  <Input
                    value={lmStudioQuery}
                    onChange={(event) => setLmStudioQuery(event.target.value)}
                    placeholder="Search local models..."
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => setLmStudioMenuOpen((value) => !value)}>
                    {lmStudioMenuOpen ? 'Close local model list' : 'Open local model list'}
                  </Button>
                  {lmStudioMenuOpen ? (
                    <div
                      className="max-h-56 overflow-y-auto overscroll-contain rounded-lg border bg-muted/20 p-1"
                      onWheel={(event) => event.stopPropagation()}
                    >
                      {filteredLmStudioModels.length ? (
                        filteredLmStudioModels.map((model) => (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => {
                              setAiSettings((current) => ({
                                ...current,
                                lmStudioContentModel: model.id,
                              }))
                              setLmStudioMenuOpen(false)
                            }}
                            className={`w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${
                              aiSettings.lmStudioContentModel === model.id ? 'bg-primary/10 text-primary' : ''
                            }`}
                          >
                            {model.id}
                          </button>
                        ))
                      ) : (
                        <p className="px-2 py-1.5 text-xs text-muted-foreground">No matching local models.</p>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void saveWorkspaceAiSettings()} disabled={workspaceAiSettingsSaving || !currentWorkspaceId}>
                    {workspaceAiSettingsSaving ? 'Saving AI settings...' : 'Save AI settings'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Local override</CardTitle>
                <CardDescription>Use this when you want content generation off the cloud path.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="rounded-2xl border bg-muted/30 p-4">
                  <p className="font-medium text-foreground">Current local model</p>
                  <p className="mt-2">{aiSettings.lmStudioContentModel || 'No local model selected yet.'}</p>
                </div>
                <div className="rounded-2xl border bg-muted/30 p-4">
                  <p className="font-medium text-foreground">Best use</p>
                  <p className="mt-2">Set Content AI to LM Studio when you want local copy generation in place of the general OpenRouter model.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
