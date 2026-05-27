import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ImageIcon, Loader2, Send } from 'lucide-react'
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export type ComposeFlowStep = 'draft' | 'visual' | 'publish'

type ComposeFlowProgressModalProps = {
  open: boolean
  activeStep: ComposeFlowStep
  label: string
  draftReady: boolean
  hasVisual: boolean
  copyLoading: boolean
  copyAction: 'draft' | 'polish' | null
  imageLoading: boolean
  videoLoading: boolean
  publishing: boolean
  mediaSourceLabel: string
}

const STEPS: Array<{
  id: ComposeFlowStep
  title: string
  waiting: string
  active: string
  done: string
}> = [
  {
    id: 'draft',
    title: 'Create post content',
    waiting: 'Waiting for your topic',
    active: 'Writing your caption…',
    done: 'Draft ready',
  },
  {
    id: 'visual',
    title: 'Generate image or video',
    waiting: 'Unlocks after draft',
    active: 'Generating media…',
    done: 'Visual ready',
  },
  {
    id: 'publish',
    title: 'Preview and publish',
    waiting: 'Add a visual to continue',
    active: 'Publishing your post…',
    done: 'Ready to preview',
  },
]

export function ComposeFlowProgressModal({
  open,
  activeStep,
  label,
  draftReady,
  hasVisual,
  copyLoading,
  copyAction,
  imageLoading,
  videoLoading,
  publishing,
  mediaSourceLabel,
}: ComposeFlowProgressModalProps) {
  const [mounted, setMounted] = useState(open)
  const hasEnteredRef = useRef(false)
  const visualInProgress = imageLoading || videoLoading

  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    const unmountTimer = window.setTimeout(() => setMounted(false), 220)
    return () => window.clearTimeout(unmountTimer)
  }, [open])

  useEffect(() => {
    if (open) {
      hasEnteredRef.current = true
    }
  }, [open])

  const stepStatus = (step: ComposeFlowStep): 'done' | 'active' | 'waiting' => {
    if (step === 'draft') {
      if (copyLoading) return 'active'
      if (draftReady) return 'done'
      return 'waiting'
    }
    if (step === 'visual') {
      if (imageLoading || videoLoading) return 'active'
      if (hasVisual) return 'done'
      if (draftReady && activeStep === 'visual') return 'waiting'
      if (draftReady) return 'waiting'
      return 'waiting'
    }
    if (publishing) return 'active'
    if (hasVisual && draftReady) return 'done'
    return 'waiting'
  }

  const stepDetail = (step: ComposeFlowStep): string => {
    const meta = STEPS.find((entry) => entry.id === step)!
    const status = stepStatus(step)
    if (status === 'active') {
      if (step === 'draft' && copyAction === 'polish') return 'Polishing your caption…'
      if (step === 'draft') return 'Writing your caption…'
      if (step === 'visual' && imageLoading) return 'Designing your image…'
      if (step === 'visual' && videoLoading) return 'Rendering your video…'
      return meta.active
    }
    if (status === 'done') {
      if (step === 'visual' && !imageLoading && !videoLoading) {
        return hasVisual ? meta.done : `Using ${mediaSourceLabel}`
      }
      return meta.done
    }
    return meta.waiting
  }

  if (!mounted) {
    return null
  }

  return (
    <Dialog
      open={open}
      forceMount
      panelClassName="w-full max-w-lg p-0"
      overlayClassName="bg-black/60 backdrop-blur-[2px]"
    >
      <div className={cn('overflow-hidden', !hasEnteredRef.current && 'compose-flow-modal')}>
        <div className="alive-shimmer h-1 w-full" />
        <DialogHeader className="border-b px-6 py-5 text-left">
          <DialogTitle className="flex min-h-7 items-center gap-2 text-lg">
            <span className="alive-status-dot shrink-0" />
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
            <span className="min-w-0 truncate transition-opacity duration-200">{label}</span>
          </DialogTitle>
          <DialogDescription>Post Intelligence is working through your compose flow.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 py-5">
          {STEPS.map((step) => {
            const status = stepStatus(step.id)
            const isActive = activeStep === step.id || status === 'active'
            return (
              <div
                key={step.id}
                className={cn(
                  'rounded-2xl border px-4 py-3 transition-[background-color,border-color,box-shadow] duration-300 ease-out',
                  isActive ? 'alive-ring border-primary/30 bg-primary/5' : 'bg-muted/30',
                  status === 'done' &&
                    !isActive &&
                    !visualInProgress &&
                    'border-emerald-500/20 bg-emerald-500/5',
                  status === 'done' &&
                    !isActive &&
                    visualInProgress &&
                    'border-border/70 bg-muted/25',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{step.title}</span>
                  {status === 'done' ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                  ) : status === 'active' ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                  ) : step.id === 'visual' ? (
                    <ImageIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                  ) : step.id === 'publish' ? (
                    <Send className="h-5 w-5 shrink-0 text-muted-foreground" />
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{stepDetail(step.id)}</p>
              </div>
            )
          })}
        </div>
      </div>
    </Dialog>
  )
}
