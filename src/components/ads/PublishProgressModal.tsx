import { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, Loader2, PartyPopper, RotateCcw, Settings, Sparkles, TriangleAlert } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type PublishPhase = 'publishing' | 'success' | 'error'

type PublishProgressModalProps = {
  open: boolean
  phase: PublishPhase
  adId?: string | null
  warnings?: string[]
  error?: string | null
  /** Deep link to Meta Ads Manager for the ad account, if known. */
  adsManagerUrl?: string | null
  onClose: () => void
  onViewLibrary?: () => void
  onStartNew?: () => void
  onReconnect?: () => void
}

const STEPS = [
  'Preparing your campaign',
  'Building the ad set',
  'Uploading the creative',
  'Creating the ad',
  'Finalising on Meta',
]

export function PublishProgressModal({
  open,
  phase,
  adId,
  warnings,
  error,
  adsManagerUrl,
  onClose,
  onViewLibrary,
  onStartNew,
  onReconnect,
}: PublishProgressModalProps) {
  const [activeStep, setActiveStep] = useState(0)

  // While the single publish request is in flight, animate through the steps so
  // the flow feels alive. Meta runs them server-side, so this is a confident
  // simulation that resolves to the real result.
  useEffect(() => {
    if (phase !== 'publishing') return
    setActiveStep(0)
    const id = setInterval(() => {
      setActiveStep((s) => (s < STEPS.length - 1 ? s + 1 : s))
    }, 1100)
    return () => clearInterval(id)
  }, [phase, open])

  const reconnectHinted = Boolean(error && /reconnect|connection|not visible|permission/i.test(error))

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Don't allow dismissing mid-publish.
        if (!next && phase !== 'publishing') onClose()
      }}
      panelClassName="w-full max-w-md overflow-hidden p-0"
    >
      <style>{`
        @keyframes pp-pop { 0% { transform: scale(0.4); opacity: 0 } 60% { transform: scale(1.12) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes pp-fall { 0% { transform: translateY(-12px) rotate(0); opacity: 1 } 100% { transform: translateY(120px) rotate(220deg); opacity: 0 } }
        @keyframes pp-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
        .pp-pop { animation: pp-pop .5s cubic-bezier(.2,.8,.2,1) both }
        .pp-confetti { position: absolute; width: 8px; height: 8px; border-radius: 2px; animation: pp-fall 1.4s linear forwards }
        .pp-float { animation: pp-float 2.4s ease-in-out infinite }
      `}</style>

      {phase === 'publishing' ? (
        <div className="relative flex flex-col items-center gap-5 bg-gradient-to-b from-[#1877F2]/10 via-background to-background px-6 py-8 text-center">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-[#1877F2]/20" />
            <div className="pp-float relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1877F2] text-white shadow-lg">
              <Sparkles className="h-7 w-7" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Publishing your ad to Meta</h2>
            <p className="text-sm text-muted-foreground">Hang tight - this usually takes a few seconds.</p>
          </div>
          <ul className="w-full space-y-2 text-left">
            {STEPS.map((step, index) => {
              const done = index < activeStep
              const current = index === activeStep
              return (
                <li
                  key={step}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors',
                    current ? 'border-[#1877F2]/40 bg-[#1877F2]/5' : 'border-transparent',
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : current ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#1877F2]" />
                  ) : (
                    <span className="h-4 w-4 shrink-0 rounded-full border" />
                  )}
                  <span className={cn(done && 'text-muted-foreground line-through', current && 'font-medium')}>
                    {step}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {phase === 'success' ? (
        <div className="relative flex flex-col items-center gap-4 overflow-hidden bg-gradient-to-b from-emerald-500/15 via-background to-background px-6 py-8 text-center">
          {/* Confetti */}
          {Array.from({ length: 14 }).map((_, i) => (
            <span
              key={i}
              className="pp-confetti"
              style={{
                left: `${8 + i * 6.2}%`,
                top: '10px',
                background: ['#1877F2', '#22C55E', '#F59E0B', '#E11D48', '#8B5CF6'][i % 5],
                animationDelay: `${(i % 5) * 0.12}s`,
              }}
            />
          ))}
          <div className="pp-pop relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
            <PartyPopper className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold">🎉 Your ad is on Meta!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              It was created <span className="font-medium text-foreground">paused</span> and is ready to go live.
            </p>
          </div>

          <div className="w-full rounded-xl border bg-muted/30 p-3 text-left text-sm">
            <p className="font-medium">What's next</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-muted-foreground">
              <li>Open Meta Ads Manager and switch the ad to <span className="font-medium text-foreground">Active</span>.</li>
              <li>Make sure your ad account has a payment method.</li>
              <li>Track performance back here in Analytics.</li>
            </ol>
            {adId ? <p className="mt-2 text-xs text-muted-foreground">Ad ID: <span className="font-mono">{adId}</span></p> : null}
            {warnings && warnings.length > 0 ? (
              <p className="mt-2 text-xs text-amber-600">{warnings.join(' ')}</p>
            ) : null}
          </div>

          <div className="flex w-full flex-col gap-2">
            {adsManagerUrl ? (
              <a href={adsManagerUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                <Button className="w-full">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Activate in Meta Ads Manager
                </Button>
              </a>
            ) : null}
            <div className="flex gap-2">
              {onViewLibrary ? (
                <Button variant="outline" className="flex-1" onClick={onViewLibrary}>
                  View in Ad Library
                </Button>
              ) : null}
              {onStartNew ? (
                <Button variant="outline" className="flex-1" onClick={onStartNew}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  New ad
                </Button>
              ) : null}
            </div>
            <Button variant="ghost" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : null}

      {phase === 'error' ? (
        <div className="flex flex-col items-center gap-4 bg-gradient-to-b from-amber-500/10 via-background to-background px-6 py-8 text-center">
          <div className="pp-pop flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg">
            <TriangleAlert className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Publishing hit a snag</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your draft is safe - nothing was lost.</p>
          </div>
          <div className="w-full rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-left text-sm text-destructive">
            {error || 'Something went wrong while publishing.'}
          </div>
          <div className="flex w-full flex-col gap-2">
            {reconnectHinted && onReconnect ? (
              <Button className="w-full" onClick={onReconnect}>
                <Settings className="mr-2 h-4 w-4" />
                Reconnect Facebook in Settings
              </Button>
            ) : null}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Close
              </Button>
              <Button className="flex-1" onClick={onStartNew ?? onClose}>
                Try again
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Dialog>
  )
}
