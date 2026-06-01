import { useMemo, useRef, useState } from 'react'
import { CalendarClock, ImageOff, ImagePlus, Loader2, RefreshCw, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { isDemoMode } from '@/lib/demo'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ConfirmProvider'
import { supabase } from '@/lib/supabase'
import { sanitizeComposeCopy } from '@/lib/compose-copy'
import { computeScheduleSlots, WEEKDAYS } from '@/lib/bulk-schedule'
import { cn } from '@/lib/utils'

type InvokeAi = <T,>(functionName: string, body: Record<string, unknown>) => Promise<T>

type BulkScheduleModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string | null
  userId: string | undefined
  /** First version targets Facebook only. */
  platform: string
  platformLabel: string
  invokeAi: InvokeAi
  onScheduled?: (count: number) => void
}

type Variant = {
  id: string
  caption: string
  imageUrl: string | null
  time: Date
}

type Phase = 'setup' | 'generating' | 'review'

const MAX_VARIANTS = 12

function todayLocalISODate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function BulkScheduleModal({
  open,
  onOpenChange,
  workspaceId,
  userId,
  platform,
  platformLabel,
  invokeAi,
  onScheduled,
}: BulkScheduleModalProps) {
  const confirm = useConfirm()
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(5)
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5])
  const [timeSlots, setTimeSlots] = useState<string[]>(['18:00'])
  const [startDate, setStartDate] = useState<string>(() => todayLocalISODate())

  const [phase, setPhase] = useState<Phase>('setup')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [variants, setVariants] = useState<Variant[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const uploadTargetId = useRef<string | null>(null)

  const slots = useMemo(
    () => computeScheduleSlots({ startDate, weekdays: selectedDays, times: timeSlots, count }),
    [startDate, selectedDays, timeSlots, count],
  )

  const setupValid =
    topic.trim().length > 0 && selectedDays.length > 0 && timeSlots.length > 0 && count > 0 && slots.length > 0

  const reset = () => {
    setPhase('setup')
    setVariants([])
    setProgress({ done: 0, total: 0 })
    setMessage('')
    setBusy(false)
  }

  const close = () => {
    if (busy) return
    onOpenChange(false)
    // Defer reset so the closing animation doesn't flash the setup screen.
    setTimeout(reset, 200)
  }

  const toggleDay = (value: number) => {
    setSelectedDays((days) => (days.includes(value) ? days.filter((d) => d !== value) : [...days, value]))
  }

  const updateTimeSlot = (index: number, value: string) => {
    setTimeSlots((slotsList) => slotsList.map((t, i) => (i === index ? value : t)))
  }

  const addTimeSlot = () => setTimeSlots((slotsList) => [...slotsList, '12:00'])
  const removeTimeSlot = (index: number) =>
    setTimeSlots((slotsList) => (slotsList.length > 1 ? slotsList.filter((_, i) => i !== index) : slotsList))

  const generate = async () => {
    if (!setupValid || !workspaceId) return
    const times = slots.slice(0, count)
    setBusy(true)
    setPhase('generating')
    setProgress({ done: 0, total: times.length })
    setMessage('')
    const built: Variant[] = []
    try {
      for (let i = 0; i < times.length; i += 1) {
        const variationHint = `Variation ${i + 1} of ${times.length}: use a fresh hook and angle, distinct from the other variations.`
        let caption = ''
        try {
          const copy = await invokeAi<{ content?: string }>('generate-compose-copy', {
            platform,
            mode: 'draft',
            topic: `${topic}\n\n${variationHint}`,
            workspace_id: workspaceId,
          })
          caption = sanitizeComposeCopy(copy.content ?? '')
        } catch (err) {
          caption = ''
          setMessage(err instanceof Error ? `Copy generation hiccup on #${i + 1}: ${err.message}` : '')
        }

        let imageUrl: string | null = null
        try {
          const media = await invokeAi<{ url?: string }>('generate-image', {
            platform,
            post_text: caption,
            topic,
            prompt: `${topic}. ${variationHint} Distinct composition and visual treatment.`,
          })
          imageUrl = media.url ?? null
        } catch (err) {
          imageUrl = null
          setMessage(err instanceof Error ? `Image generation hiccup on #${i + 1}: ${err.message}` : '')
        }

        built.push({
          id: `${Date.now()}-${i}`,
          caption,
          imageUrl,
          time: times[i],
        })
        setProgress({ done: i + 1, total: times.length })
      }
      setVariants(built)
      setPhase('review')
    } finally {
      setBusy(false)
    }
  }

  const updateVariant = (id: string, patch: Partial<Variant>) => {
    setVariants((list) => list.map((v) => (v.id === id ? { ...v, ...patch } : v)))
  }

  const removeVariant = (id: string) => {
    setVariants((list) => list.filter((v) => v.id !== id))
  }

  const regenerateImage = async (variant: Variant) => {
    setRegeneratingId(variant.id)
    setMessage('')
    try {
      const media = await invokeAi<{ url?: string }>('generate-image', {
        platform,
        post_text: variant.caption,
        topic,
        prompt: `${topic || variant.caption}. Fresh composition and visual treatment.`,
      })
      if (media.url) {
        updateVariant(variant.id, { imageUrl: media.url })
      } else {
        setMessage('Image came back empty — try again or upload your own.')
      }
    } catch (err) {
      setMessage(err instanceof Error ? `Couldn't regenerate image: ${err.message}` : "Couldn't regenerate image.")
    } finally {
      setRegeneratingId(null)
    }
  }

  const openUpload = (id: string) => {
    uploadTargetId.current = id
    uploadInputRef.current?.click()
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const targetId = uploadTargetId.current
    event.target.value = ''
    if (!file || !targetId) return

    if (isDemoMode) {
      updateVariant(targetId, { imageUrl: URL.createObjectURL(file) })
      return
    }

    if (!workspaceId || !userId) {
      setMessage('Pick a workspace before uploading an image.')
      return
    }

    setRegeneratingId(targetId)
    setMessage('')
    try {
      const path = `${workspaceId}/${userId}/${Date.now()}_${file.name}`
      const { data, error } = await supabase.storage.from('media').upload(path, file)
      if (error || !data) {
        setMessage(error?.message ?? 'Upload failed.')
        return
      }
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(data.path)
      updateVariant(targetId, { imageUrl: urlData.publicUrl })
    } finally {
      setRegeneratingId(null)
    }
  }

  const clearImage = (id: string) => updateVariant(id, { imageUrl: null })

  const missingImages = variants.filter((v) => !v.imageUrl).length

  const scheduleAll = async () => {
    if (!workspaceId || !userId) {
      setMessage('Pick a workspace before scheduling.')
      return
    }
    const ready = variants.filter((v) => v.caption.trim().length > 0)
    if (ready.length === 0) {
      setMessage('Add some caption text before scheduling.')
      return
    }

    const withoutImage = ready.filter((v) => !v.imageUrl).length
    if (withoutImage > 0) {
      const confirmed = await confirm({
        title: `${withoutImage} post${withoutImage === 1 ? '' : 's'} ${withoutImage === 1 ? 'has' : 'have'} no image`,
        description:
          `${withoutImage === 1 ? 'It' : 'They'} will be scheduled as text-only. You can regenerate or upload an ` +
          'image for each post in the list first. Schedule anyway?',
        confirmLabel: 'Schedule anyway',
        cancelLabel: 'Go back',
      })
      if (!confirmed) return
    }

    setBusy(true)
    setMessage('')
    let scheduled = 0
    try {
      for (const variant of ready) {
        const mediaUrls = variant.imageUrl ? [variant.imageUrl] : []
        const mediaTypes = variant.imageUrl ? ['image'] : []
        const taskRes = await supabase
          .from('planner_tasks')
          .insert({
            user_id: userId,
            workspace_id: workspaceId,
            title: variant.caption.slice(0, 60) || `${platformLabel} post`,
            description: variant.caption,
            scheduled_at: variant.time.toISOString(),
            duration_minutes: 15,
            status: 'scheduled',
            kind: 'post',
            platform,
            payload: { media_urls: mediaUrls, media_types: mediaTypes, link_url: '' },
          } as never)
          .select()
          .single()
        if (taskRes.error) throw taskRes.error
        const createdTask = taskRes.data as { id: string }
        const postRes = await supabase.from('scheduled_posts').insert({
          planner_task_id: createdTask.id,
          platform,
          content: variant.caption,
          media_urls: mediaUrls.length ? mediaUrls : null,
        } as never)
        if (postRes.error) throw postRes.error
        scheduled += 1
      }
      onScheduled?.(scheduled)
      onOpenChange(false)
      setTimeout(reset, 200)
    } catch (err) {
      setMessage(
        err instanceof Error
          ? `Scheduled ${scheduled}/${ready.length} before an error: ${err.message}`
          : 'Could not schedule the posts.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          Bulk schedule variants
        </DialogTitle>
        <DialogDescription>
          Generate several {platformLabel} posts with rotating AI images and copy, then schedule them across your
          chosen days and times.
        </DialogDescription>
      </DialogHeader>

      {phase === 'setup' ? (
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="bulk-topic">Topic / theme</Label>
            <Textarea
              id="bulk-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Weekly tips for first-home buyers on the Gold Coast"
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-count">How many posts</Label>
              <Input
                id="bulk-count"
                type="number"
                min={1}
                max={MAX_VARIANTS}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(MAX_VARIANTS, Number(e.target.value) || 1)))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-start">Start date</Label>
              <Input
                id="bulk-start"
                type="date"
                value={startDate}
                min={todayLocalISODate()}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Days of week</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    selectedDays.includes(day.value)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'hover:bg-muted',
                  )}
                >
                  {day.short}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Time slots</Label>
            <div className="flex flex-wrap items-center gap-2">
              {timeSlots.map((time, index) => (
                <div key={index} className="flex items-center gap-1">
                  <Input
                    type="time"
                    value={time}
                    onChange={(e) => updateTimeSlot(index, e.target.value)}
                    className="w-32"
                  />
                  {timeSlots.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeTimeSlot(index)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Remove time slot"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addTimeSlot}>
                Add time
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {slots.length >= count
                ? `First post: ${slots[0]?.toLocaleString() ?? '—'}`
                : `Only ${slots.length} future slot${slots.length === 1 ? '' : 's'} fit — add days/times or lower the count.`}
            </p>
          </div>

          {message ? <p className="text-xs text-destructive">{message}</p> : null}

          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button onClick={() => void generate()} disabled={!setupValid}>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate {count} variant{count === 1 ? '' : 's'}
            </Button>
          </DialogFooter>
        </div>
      ) : null}

      {phase === 'generating' ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">
            Generating variant {Math.min(progress.done + 1, progress.total)} of {progress.total}…
          </p>
          <p className="text-xs text-muted-foreground">Writing copy and rendering an image for each. This can take a minute.</p>
          {message ? <p className="text-xs text-amber-600">{message}</p> : null}
        </div>
      ) : null}

      {phase === 'review' ? (
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Review and tweak each post before it&apos;s scheduled. Edit the caption, and use the buttons on each image to
            regenerate, upload your own, or remove it. {variants.length} post{variants.length === 1 ? '' : 's'} ready.
          </p>
          {missingImages > 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <ImageOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {missingImages} post{missingImages === 1 ? '' : 's'} {missingImages === 1 ? 'has' : 'have'} no image and
                will be scheduled as text-only unless you add a photo below.
              </span>
            </div>
          ) : null}
          <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
            {variants.map((variant) => (
              <div key={variant.id} className="flex gap-3 rounded-xl border p-3">
                <div className="flex shrink-0 flex-col items-center gap-1.5">
                  <div className="relative h-20 w-20">
                    {variant.imageUrl ? (
                      <img src={variant.imageUrl} alt="" className="h-20 w-20 rounded-lg border object-cover" />
                    ) : (
                      <div className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-muted text-[10px] text-muted-foreground">
                        <ImageOff className="h-4 w-4" />
                        No image
                      </div>
                    )}
                    {regeneratingId === variant.id ? (
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => void regenerateImage(variant)}
                      disabled={regeneratingId === variant.id}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                      title="Regenerate image with AI"
                      aria-label="Regenerate image"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openUpload(variant.id)}
                      disabled={regeneratingId === variant.id}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                      title="Upload your own image"
                      aria-label="Upload image"
                    >
                      {variant.imageUrl ? <Upload className="h-3.5 w-3.5" /> : <ImagePlus className="h-3.5 w-3.5" />}
                    </button>
                    {variant.imageUrl ? (
                      <button
                        type="button"
                        onClick={() => clearImage(variant.id)}
                        disabled={regeneratingId === variant.id}
                        className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        title="Remove image"
                        aria-label="Remove image"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {variant.time.toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeVariant(variant.id)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remove variant"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Textarea
                    value={variant.caption}
                    onChange={(e) => updateVariant(variant.id, { caption: e.target.value })}
                    rows={3}
                    className="text-sm"
                  />
                </div>
              </div>
            ))}
          </div>

          {message ? <p className="text-xs text-destructive">{message}</p> : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPhase('setup')} disabled={busy}>
              Back
            </Button>
            <Button onClick={() => void scheduleAll()} disabled={busy || variants.length === 0}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
              Schedule {variants.length} post{variants.length === 1 ? '' : 's'}
            </Button>
          </DialogFooter>
        </div>
      ) : null}

      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleUpload(e)}
      />
    </Dialog>
  )
}
