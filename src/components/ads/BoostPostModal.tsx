import { useState } from 'react'
import { CheckCircle2, ExternalLink, Loader2, Rocket, TriangleAlert } from 'lucide-react'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { LOCATION_OPTIONS } from '@/lib/ads-targeting-options'
import { boostPost } from '@/lib/ads-publish'

type BoostPostModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string | null
  metaAccountId: string | null
  postId: string | null
  postPreview?: string
  onBoosted?: () => void
}

type Phase = 'setup' | 'boosting' | 'success' | 'error'

export function BoostPostModal({
  open,
  onOpenChange,
  workspaceId,
  metaAccountId,
  postId,
  postPreview,
  onBoosted,
}: BoostPostModalProps) {
  const [budget, setBudget] = useState(20)
  const [duration, setDuration] = useState(7)
  const [location, setLocation] = useState(LOCATION_OPTIONS[0]?.value ?? 'Australia')
  const [phase, setPhase] = useState<Phase>('setup')
  const [error, setError] = useState('')
  const [adId, setAdId] = useState<string | null>(null)

  const adsManagerUrl = metaAccountId
    ? `https://www.facebook.com/adsmanager/manage/ads?act=${metaAccountId.replace(/^act_/, '')}`
    : null

  const close = () => {
    if (phase === 'boosting') return
    onOpenChange(false)
    setTimeout(() => {
      setPhase('setup')
      setError('')
      setAdId(null)
    }, 200)
  }

  const runBoost = async () => {
    if (!workspaceId || !metaAccountId || !postId) {
      setError('This post can’t be boosted yet (missing account or post id).')
      setPhase('error')
      return
    }
    setPhase('boosting')
    setError('')
    const result = await boostPost({
      workspaceId,
      metaAccountId,
      postId,
      totalBudget: budget,
      durationDays: duration,
      location,
    })
    if (!result.ok) {
      setError(result.error ?? 'Boost failed.')
      setPhase('error')
      return
    }
    setAdId(result.ad_id ?? null)
    setPhase('success')
    onBoosted?.()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      panelClassName="w-full max-w-md p-0 overflow-hidden"
    >
      <DialogHeader className="px-6 pt-6">
        <DialogTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-[#1877F2]" />
          Boost this post
        </DialogTitle>
        <DialogDescription>
          Promote your published post as a Meta ad to reach more people. It’s created paused so you can review it first.
        </DialogDescription>
      </DialogHeader>

      {phase === 'setup' || phase === 'boosting' ? (
        <div className="space-y-4 px-6 py-4">
          {postPreview ? (
            <p className="line-clamp-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {postPreview}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="boost-budget">Total budget ($)</Label>
              <Input
                id="boost-budget"
                type="number"
                min={1}
                value={budget}
                onChange={(e) => setBudget(Math.max(1, Number(e.target.value) || 1))}
                disabled={phase === 'boosting'}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="boost-duration">Duration (days)</Label>
              <Input
                id="boost-duration"
                type="number"
                min={1}
                max={90}
                value={duration}
                onChange={(e) => setDuration(Math.max(1, Math.min(90, Number(e.target.value) || 1)))}
                disabled={phase === 'boosting'}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="boost-location">Location</Label>
            <Select
              id="boost-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={phase === 'boosting'}
            >
              {LOCATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            ≈ ${(budget / duration).toFixed(2)}/day over {duration} day{duration === 1 ? '' : 's'}.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={phase === 'boosting'}>
              Cancel
            </Button>
            <Button onClick={() => void runBoost()} disabled={phase === 'boosting'}>
              {phase === 'boosting' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="mr-2 h-4 w-4" />
              )}
              {phase === 'boosting' ? 'Boosting…' : 'Boost post'}
            </Button>
          </DialogFooter>
        </div>
      ) : null}

      {phase === 'success' ? (
        <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold">Boost created on Meta 🚀</h2>
          <p className="text-sm text-muted-foreground">
            It’s <span className="font-medium text-foreground">paused</span>. Activate it in Ads Manager to start
            reaching people.
          </p>
          {adId ? <p className="text-xs text-muted-foreground">Ad ID: <span className="font-mono">{adId}</span></p> : null}
          <div className="mt-2 flex w-full flex-col gap-2">
            {adsManagerUrl ? (
              <a href={adsManagerUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                <Button className="w-full">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Activate in Meta Ads Manager
                </Button>
              </a>
            ) : null}
            <Button variant="ghost" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      ) : null}

      {phase === 'error' ? (
        <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white">
            <TriangleAlert className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold">Couldn’t boost the post</h2>
          <p className="w-full rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-left text-sm text-destructive">
            {error}
          </p>
          <div className="flex w-full gap-2">
            <Button variant="outline" className="flex-1" onClick={close}>
              Close
            </Button>
            <Button className="flex-1" onClick={() => setPhase('setup')}>
              Try again
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  )
}
