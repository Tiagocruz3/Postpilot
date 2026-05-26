import { useEffect, useState } from 'react'
import { Calendar, Loader2, Sparkles } from 'lucide-react'
import { isDemoMode } from '@/lib/demo'
import type { ComposePlatform } from '@/lib/compose-copy'
import { platformLabel } from '@/lib/compose-copy'
import {
  captionWithHashtags,
  DEFAULT_REMIX_FORM,
  type RemixFormValues,
  type RemixReport,
  remixInspiration,
} from '@/lib/post-intelligence'
import { Button } from '@/components/ui/button'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const DEMO_REMIX: RemixReport = {
  original_post_summary: 'A competitor shared a quick tip post with a strong hook and clear CTA.',
  why_it_works: 'Opens with a pain point, delivers one actionable tip, ends with a soft CTA.',
  content_structure: 'Hook, insight, proof point, CTA',
  brand_safe_version:
    'If content feels like a chore, simplify. Answer one real customer question each week in plain language. That earns attention without copying anyone else.',
  hooks: ['Stop guessing what to post.', 'One change that improved our results.', 'Try this before your next campaign.'],
  caption:
    'If content feels like a chore, simplify. Pick one customer question you heard this week and answer it in plain language.',
  cta: 'Save this for your next planning session.',
  hashtags: ['ContentStrategy', 'SmallBusiness'],
  visual_idea: 'Clean carousel: problem slide, tip slide, CTA slide with your brand colors (not the original style).',
  recommended_schedule_time: 'Same day next week, similar morning window',
}

interface RemixPostModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  platform: ComposePlatform
  brandName: string
  workspaceId?: string | null
  initialPostText?: string
  initialCompetitorNiche?: string
  onSendToComposer: (caption: string, visualIdea: string, scheduleHint: string) => void
  onGenerateVisual: (visualIdea: string) => void
  onScheduleInspiredPost: (caption: string, visualIdea: string, scheduleHint: string) => void
}

export function RemixPostModal({
  open,
  onOpenChange,
  platform,
  brandName,
  workspaceId,
  initialPostText = '',
  initialCompetitorNiche = '',
  onSendToComposer,
  onGenerateVisual,
  onScheduleInspiredPost,
}: RemixPostModalProps) {
  const [form, setForm] = useState<RemixFormValues>({
    ...DEFAULT_REMIX_FORM,
    original_post_text: initialPostText,
    competitor_niche: initialCompetitorNiche,
  })
  const [report, setReport] = useState<RemixReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm({
        ...DEFAULT_REMIX_FORM,
        original_post_text: initialPostText,
        competitor_niche: initialCompetitorNiche,
      })
      setReport(null)
      setError('')
    }
  }, [open, initialPostText, initialCompetitorNiche])

  const runRemix = async () => {
    if (!form.original_post_text.trim()) {
      setError('Paste the public post you want inspiration from.')
      return
    }

    setLoading(true)
    setError('')
    try {
      if (isDemoMode) {
        setReport(DEMO_REMIX)
        return
      }
      const { report: next } = await remixInspiration(platform, brandName, form, workspaceId)
      setReport(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remix failed.')
    } finally {
      setLoading(false)
    }
  }

  const fullCaption = report
    ? captionWithHashtags(`${report.caption}\n\n${report.cta}`, report.hashtags)
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Remix This Post
          </DialogTitle>
          <DialogDescription>
            Inspiration Engine · Brand-safe rewrite for {platformLabel(platform)}. Original idea, your voice.
          </DialogDescription>
        </DialogHeader>

        {!report ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 grid gap-1.5">
              <Label>Original post text</Label>
              <Textarea
                value={form.original_post_text}
                onChange={(e) => setForm((f) => ({ ...f, original_post_text: e.target.value }))}
                className="min-h-[120px]"
                placeholder="Paste the public post caption here..."
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Account niche</Label>
              <Input
                value={form.competitor_niche}
                onChange={(e) => setForm((f) => ({ ...f, competitor_niche: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Your niche</Label>
              <Input value={form.user_niche} onChange={(e) => setForm((f) => ({ ...f, user_niche: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Your audience</Label>
              <Input
                value={form.target_audience}
                onChange={(e) => setForm((f) => ({ ...f, target_audience: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Tone</Label>
              <Input value={form.tone} onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Your offer</Label>
              <Input value={form.offer} onChange={(e) => setForm((f) => ({ ...f, offer: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 grid gap-1.5">
              <Label>Post goal</Label>
              <Input value={form.post_goal} onChange={(e) => setForm((f) => ({ ...f, post_goal: e.target.value }))} />
            </div>
            {error ? <p className="sm:col-span-2 text-sm text-destructive">{error}</p> : null}
            <DialogFooter className="sm:col-span-2 mt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => void runRemix()} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Create my version
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="mt-4 space-y-4 text-sm">
            <section>
              <h3 className="font-medium">Original post summary</h3>
              <p className="text-muted-foreground">{report.original_post_summary}</p>
            </section>
            <section>
              <h3 className="font-medium">Why this post works</h3>
              <p className="text-muted-foreground">{report.why_it_works}</p>
            </section>
            <section>
              <h3 className="font-medium">Content structure</h3>
              <p className="text-muted-foreground">{report.content_structure}</p>
            </section>
            <section>
              <h3 className="font-medium">Original brand-safe version</h3>
              <p className="text-muted-foreground">{report.brand_safe_version}</p>
            </section>
            <section>
              <h3 className="font-medium">Caption</h3>
              <Textarea readOnly value={fullCaption} className="min-h-[120px]" />
            </section>
            <section>
              <h3 className="font-medium">3 alternative hooks</h3>
              <ul className="list-decimal pl-5 text-muted-foreground">
                {report.hooks.map((hook) => (
                  <li key={hook}>{hook}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="font-medium">Visual idea</h3>
              <p className="text-muted-foreground">{report.visual_idea}</p>
            </section>
            <section>
              <h3 className="font-medium">Recommended schedule time</h3>
              <p className="text-muted-foreground">{report.recommended_schedule_time}</p>
            </section>
            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={() => setReport(null)}>
                Remix another
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  onGenerateVisual(report.visual_idea)
                  onOpenChange(false)
                }}
              >
                Generate my version
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  onSendToComposer(fullCaption, report.visual_idea, report.recommended_schedule_time)
                  onOpenChange(false)
                }}
              >
                Send to composer
              </Button>
              <Button
                onClick={() => {
                  onScheduleInspiredPost(fullCaption, report.visual_idea, report.recommended_schedule_time)
                  onOpenChange(false)
                }}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Schedule inspired post
              </Button>
            </DialogFooter>
          </div>
        )}
      </div>
    </Dialog>
  )
}
