import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AppFooter } from '@/components/AppFooter'

export function WorkspaceSetupPage() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const { createWorkspace, workspaces } = useWorkspaces(user?.id ?? profile?.id)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      await createWorkspace(name.trim())
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary/5 to-background">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            {workspaces.length === 0 ? 'Create your workspace' : 'New workspace'}
          </CardTitle>
          <CardDescription>A workspace holds all your social accounts and scheduled content.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Marketing" required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3">
              {workspaces.length > 0 && (
                <Button type="button" variant="outline" className="flex-1" onClick={() => navigate('/')}>
                  Cancel
                </Button>
              )}
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Creating…' : 'Create workspace'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>
      <AppFooter compact />
    </div>
  )
}
