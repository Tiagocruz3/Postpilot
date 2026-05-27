import { KeyboardEvent } from 'react'
import { Loader2, Search, Sparkles, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type ComposeAiWriteSectionProps = {
  draftTopic: string
  onDraftTopicChange: (value: string) => void
  copyLoading: boolean
  canPolish: boolean
  onWriteWithAi: () => void
  onPolish: () => void
  onResearch: () => void
  onRemix: () => void
}

export function ComposeAiWriteSection({
  draftTopic,
  onDraftTopicChange,
  copyLoading,
  canPolish,
  onWriteWithAi,
  onPolish,
  onResearch,
  onRemix,
}: ComposeAiWriteSectionProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      if (!copyLoading && draftTopic.trim()) {
        onWriteWithAi()
      }
    }
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border-2 border-primary/25 bg-gradient-to-br from-primary/[0.07] via-background to-background p-4 shadow-sm sm:p-5">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />

      <div className="relative space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Write with AI</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">What should this post be about?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Start with a topic, angle, or bullet points. Post Intelligence drafts a human, professional caption for you.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="compose-ai-prompt" className="sr-only">
            Topic for Write with AI
          </label>
          <Textarea
            id="compose-ai-prompt"
            placeholder="e.g. New listing in downtown Austin — highlight walkability, schools, and open house Saturday…"
            value={draftTopic}
            onChange={(event) => onDraftTopicChange(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={copyLoading}
            rows={4}
            className={cn(
              'min-h-[112px] resize-y border-primary/30 bg-background text-base leading-relaxed shadow-inner',
              'placeholder:text-muted-foreground/80 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25',
            )}
          />
          <p className="text-[11px] text-muted-foreground">
            Press <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">⌘</kbd>
            {' + '}
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Enter</kbd> to write with AI
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            size="lg"
            className="h-11 flex-1 sm:min-w-[200px]"
            disabled={copyLoading || !draftTopic.trim()}
            onClick={onWriteWithAi}
          >
            {copyLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            {copyLoading ? 'Writing…' : 'Write with AI'}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-11"
            disabled={copyLoading || !canPolish}
            onClick={onPolish}
          >
            {copyLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Polish draft
          </Button>
        </div>

        <div className="flex flex-col gap-2 border-t border-primary/10 pt-4 sm:flex-row sm:flex-wrap">
          <p className="w-full text-xs font-medium uppercase tracking-wide text-muted-foreground">Research & remix</p>
          <Button type="button" variant="outline" className="h-10 flex-1 sm:flex-none" onClick={onResearch}>
            <Search className="mr-2 h-4 w-4" />
            Research Topic
          </Button>
          <Button type="button" variant="outline" className="h-10 flex-1 sm:flex-none" onClick={onRemix}>
            <Sparkles className="mr-2 h-4 w-4" />
            Remix Competitor Post
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Captions are written to stay human, professional, and avoid em dashes.
        </p>
      </div>
    </section>
  )
}
