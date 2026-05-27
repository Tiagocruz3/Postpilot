import { useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { isDemoMode } from '@/lib/demo'
import type { ComposePlatform } from '@/lib/compose-copy'
import { platformLabel } from '@/lib/compose-copy'
import {
  captionWithHashtags,
  DEFAULT_RESEARCH_FORM,
  type ResearchFormValues,
  type ResearchReport,
  researchPost,
} from '@/lib/post-intelligence'
import { Button } from '@/components/ui/button'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const DEMO_REPORT: ResearchReport = {
  summary: 'AI tools are helping agents save time on listings, follow-ups, and content.',
  trending_angles: ['Time savings', 'Better listing copy', 'Lead follow-up automation'],
  recommended_post_idea: 'Show a before/after workflow for writing listing descriptions in minutes.',
  hooks: [
    'Your next listing description does not need to take an hour.',
    'What if follow-ups wrote themselves?',
    'The busy agent guide to AI that actually helps.',
    'Stop drowning in admin. Start closing more.',
    'One tool. Three hours saved every week.',
  ],
  caption_draft:
    'Real estate moves fast. The agents winning right now are not working harder, they are working smarter with AI for listings, follow-ups, and client updates. Start small: pick one repetitive task this week and automate it.',
  hashtags: ['RealEstate', 'PropTech', 'AIForAgents'],
  visual_idea: 'Split-screen: stressed agent at laptop vs calm agent reviewing leads on phone.',
  suggested_posting_time: 'Tuesday or Thursday, 9:00–11:00 AM local time',
  sources: [{ title: 'Demo trend research', url: 'https://adguru.app' }],
}

interface ResearchTopicModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  platform: ComposePlatform
  brandName: string
  workspaceId?: string | null
  initialTopic?: string
  onUseCaption: (caption: string, visualIdea: string) => void
  onGenerateVisual: (visualIdea: string) => void
  onSchedulePost: (caption: string, suggestedTime: string) => void
}

export function ResearchTopicModal({
  open,
  onOpenChange,
  platform: parentPlatform,
  brandName,
  workspaceId,
  initialTopic = '',
  onUseCaption,
  onGenerateVisual,
  onSchedulePost,
}: ResearchTopicModalProps) {
  const [platform, setPlatform] = useState<ComposePlatform>(parentPlatform)
  const [form, setForm] = useState<ResearchFormValues>({ ...DEFAULT_RESEARCH_FORM, topic: initialTopic })
  const [report, setReport] = useState<ResearchReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setPlatform(parentPlatform)
      setForm((current) => ({ ...current, topic: initialTopic || current.topic }))
      setReport(null)
      setError('')
    }
  }, [open, parentPlatform, initialTopic])

  const runResearch = async () => {
    if (!form.topic.trim()) {
      setError('Enter a topic to research.')
      return
    }

    setLoading(true)
    setError('')
    try {
      if (isDemoMode) {
        setReport(DEMO_REPORT)
        return
      }
      const { report: next } = await researchPost(platform, brandName, form, workspaceId)
      setReport(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed.')
    } finally {
      setLoading(false)
    }
  }

  const fullCaption = report ? captionWithHashtags(report.caption_draft, report.hashtags) : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Research Topic
          </DialogTitle>
          <DialogDescription>
            Post Intelligence · Trend research for {brandName}. Optional live web search via OpenRouter.
          </DialogDescription>
        </DialogHeader>

        {!report ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 grid gap-1.5">
              <Label>Topic</Label>
              <Input
                value={form.topic}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                placeholder="e.g. AI tools for real estate agents"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Platform</Label>
              <Select value={platform} onChange={(e) => setPlatform(e.target.value as ComposePlatform)}>
                <option value="facebook">Facebook</option>
                <option value="linkedin">LinkedIn</option>
                <option value="x">X</option>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Audience</Label>
              <Input
                value={form.target_audience}
                onChange={(e) => setForm((f) => ({ ...f, target_audience: e.target.value }))}
                placeholder="e.g. real estate agents"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Tone</Label>
              <Input value={form.tone} onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Niche (optional)</Label>
              <Input value={form.niche} onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Post goal (optional)</Label>
              <Input value={form.post_goal} onChange={(e) => setForm((f) => ({ ...f, post_goal: e.target.value }))} />
            </div>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.web_search}
                onChange={(e) => setForm((f) => ({ ...f, web_search: e.target.checked }))}
              />
              Search live web
            </label>
            {error ? <p className="sm:col-span-2 text-sm text-destructive">{error}</p> : null}
            <DialogFooter className="sm:col-span-2 mt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => void runResearch()} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Research for post
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="mt-4 space-y-4 text-sm">
            <p className="text-xs text-muted-foreground">Platform: {platformLabel(platform)}</p>
            <section>
              <h3 className="font-medium">Summary of findings</h3>
              <p className="text-muted-foreground">{report.summary}</p>
            </section>
            <section>
              <h3 className="font-medium">Trending angles</h3>
              <ul className="list-disc pl-5 text-muted-foreground">
                {report.trending_angles.map((angle) => (
                  <li key={angle}>{angle}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="font-medium">Recommended post idea</h3>
              <p className="text-muted-foreground">{report.recommended_post_idea}</p>
            </section>
            <section>
              <h3 className="font-medium">5 hook options</h3>
              <ul className="list-decimal pl-5 text-muted-foreground">
                {report.hooks.map((hook) => (
                  <li key={hook}>{hook}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="font-medium">Caption draft</h3>
              <Textarea readOnly value={fullCaption} className="min-h-[100px]" />
            </section>
            <section>
              <h3 className="font-medium">Hashtags</h3>
              <p className="text-muted-foreground">{report.hashtags.join(' ')}</p>
            </section>
            <section>
              <h3 className="font-medium">Image/video idea</h3>
              <p className="text-muted-foreground">{report.visual_idea}</p>
            </section>
            <section>
              <h3 className="font-medium">Suggested posting time</h3>
              <p className="text-muted-foreground">{report.suggested_posting_time}</p>
            </section>
            {report.sources?.length ? (
              <section>
                <h3 className="font-medium">Sources</h3>
                <ul className="space-y-1">
                  {report.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {source.title || source.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={() => setReport(null)}>
                New research
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  onUseCaption(fullCaption, report.visual_idea)
                  onOpenChange(false)
                }}
              >
                Use caption
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  onGenerateVisual(report.visual_idea)
                  onOpenChange(false)
                }}
              >
                Generate visual
              </Button>
              <Button
                onClick={() => {
                  onSchedulePost(fullCaption, report.suggested_posting_time)
                  onOpenChange(false)
                }}
              >
                Schedule post
              </Button>
            </DialogFooter>
          </div>
        )}
      </div>
    </Dialog>
  )
}
