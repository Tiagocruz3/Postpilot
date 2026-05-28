import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useConfirm } from '@/components/ConfirmProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminDeleteTopup, adminSaveTopup } from '@/lib/admin/rpc'
import type { TopupPackRow } from '@/lib/admin/types'

const emptyPack = (): TopupPackRow => ({
  id: `pack_${Date.now()}`,
  name: 'New Pack',
  credits: 1000,
  price: 10,
  best_value: false,
  active: true,
  sort_order: 99,
})

type AdminTopUpsTabProps = {
  packs: TopupPackRow[]
  onRefresh: () => Promise<void>
  onMessage: (msg: string) => void
}

export function AdminTopUpsTab({ packs, onRefresh, onMessage }: AdminTopUpsTabProps) {
  const confirm = useConfirm()
  const [editing, setEditing] = useState<TopupPackRow | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!editing) return
    setBusy(true)
    try {
      await adminSaveTopup(editing)
      onMessage('Top-up pack saved.')
      setEditing(null)
      await onRefresh()
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    const ok = await confirm({
      title: 'Delete this pack?',
      confirmLabel: 'Delete',
      variant: 'destructive',
    })
    if (!ok) return
    setBusy(true)
    try {
      await adminDeleteTopup(id)
      onMessage('Pack deleted.')
      await onRefresh()
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Top-up packs</CardTitle>
            <CardDescription>One-time credit packs. Top-ups never expire and apply after monthly credits.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setEditing(emptyPack())}>
            <Plus className="mr-2 h-4 w-4" />
            Add pack
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {packs.map((pack) => (
            <div key={pack.id} className="rounded-xl border p-4">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{pack.name}</p>
                {pack.best_value ? <Badge>Best value</Badge> : null}
                {!pack.active ? <Badge variant="secondary">Inactive</Badge> : null}
              </div>
              <p className="mt-1 text-lg font-bold">{pack.credits.toLocaleString()} credits</p>
              <p className="text-muted-foreground">${pack.price}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing({ ...pack })}>Edit</Button>
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => void remove(pack.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogHeader>
          <DialogTitle>Edit top-up pack</DialogTitle>
        </DialogHeader>
        {editing ? (
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Pack ID</Label>
              <Input value={editing.id} disabled={!editing.id.startsWith('pack_')} onChange={(e) => setEditing({ ...editing, id: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Credits</Label>
              <Input type="number" value={editing.credits} onChange={(e) => setEditing({ ...editing, credits: Number(e.target.value) })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Price ($)</Label>
              <Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.best_value} onChange={(e) => setEditing({ ...editing, best_value: e.target.checked })} />
              Best value badge
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
              Active
            </label>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          <Button disabled={busy} onClick={() => void save()}>Save</Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
