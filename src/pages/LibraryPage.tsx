import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Copy, Image as ImageIcon, RefreshCcw, Trash2, Video } from 'lucide-react'
import { useConfirm } from '@/components/ConfirmProvider'
import { useAiMediaLibrary } from '@/hooks/useAiMediaLibrary'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { APP_PAGE } from '@/lib/app-labels'
import type { Workspace } from '@/types'

interface OutletContext {
  currentWorkspaceId: string | null
  currentWorkspace: Workspace | null
}

type LibraryTab = 'image' | 'video'

export function LibraryPage() {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { currentWorkspaceId, currentWorkspace } = useOutletContext<OutletContext>()
  const [activeTab, setActiveTab] = useState<LibraryTab>('image')
  const [message, setMessage] = useState('')
  const { items, loading, error, refresh, remove } = useAiMediaLibrary(currentWorkspaceId)

  const copyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url)
    setMessage('URL copied to clipboard.')
  }

  const handleDelete = async (id: string, mediaType: 'image' | 'video') => {
    const confirmed = await confirm({
      title: `Delete this ${mediaType}?`,
      description: 'It will be removed from your AI Vault for this workspace.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    })
    if (!confirmed) return

    setMessage('')
    try {
      await remove(id)
      setMessage('Removed from library.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not delete item.')
    }
  }

  const useInCompose = (url: string, type: 'image' | 'video') => {
    navigate('/compose', { state: { libraryUrl: url, libraryType: type } })
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{APP_PAGE.aiVault}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All AI-generated images and videos for {currentWorkspace?.name ?? 'this workspace'}. Shared with workspace
            members only.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {message ? (
        <div className="rounded-2xl border bg-primary/5 px-4 py-3 text-sm">{message}</div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Tabs>
        <TabsList className="mb-4">
          <TabsTrigger value="image" activeValue={activeTab} onClick={(value) => setActiveTab(value as LibraryTab)}>
            <ImageIcon className="mr-2 h-4 w-4" />
            Images
          </TabsTrigger>
          <TabsTrigger value="video" activeValue={activeTab} onClick={(value) => setActiveTab(value as LibraryTab)}>
            <Video className="mr-2 h-4 w-4" />
            Videos
          </TabsTrigger>
        </TabsList>

        {(['image', 'video'] as const).map((tab) => (
          <TabsContent key={tab} value={tab} activeValue={activeTab}>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading library…</p>
            ) : items.filter((item) => item.media_type === tab).length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">No AI {tab === 'image' ? 'images' : 'videos'} yet</CardTitle>
                  <CardDescription>
                    Generate {tab === 'image' ? 'images' : 'videos'} in {APP_PAGE.createStudio} or {APP_PAGE.growthAds}. They are saved here automatically
                    for your workspace.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => navigate('/compose')}>Open {APP_PAGE.createStudio}</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items
                  .filter((item) => item.media_type === tab)
                  .map((item) => (
                  <Card key={item.id} className="overflow-hidden">
                    <div className="aspect-square bg-muted/30">
                      {item.media_type === 'video' ? (
                        <video src={item.public_url} className="h-full w-full object-cover" muted playsInline controls />
                      ) : (
                        <img src={item.public_url} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <CardContent className="space-y-3 p-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary">{item.source}</Badge>
                        {item.metadata && typeof item.metadata === 'object' && 'platform' in item.metadata ? (
                          <Badge variant="outline">{String((item.metadata as { platform?: string }).platform)}</Badge>
                        ) : null}
                      </div>
                      {item.prompt ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{item.prompt}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => void copyUrl(item.public_url)}>
                          <Copy className="mr-1 h-3 w-3" />
                          Copy URL
                        </Button>
                        <Button size="sm" onClick={() => useInCompose(item.public_url, item.media_type)}>
                          Use in {APP_PAGE.createStudio}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => void handleDelete(item.id, item.media_type)}>
                          <Trash2 className="mr-1 h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
