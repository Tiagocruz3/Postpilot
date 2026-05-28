import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { completeChat, parseJsonFromModel } from '../_shared/ai-complete.ts'
import { withCors } from '../_shared/cors.ts'

serve(withCors(async (req) => {
  const body = await req.json().catch(() => ({}))
  const { creative, metrics, workspace_id } = body as {
    creative?: Record<string, unknown>
    metrics?: Record<string, number>
    workspace_id?: string
  }

  if (!creative) {
    return new Response(JSON.stringify({ error: 'Missing creative' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const safeMetrics = metrics ?? {}
  const hasMetrics =
    (Number(safeMetrics.impressions) || 0) > 0 ||
    (Number(safeMetrics.spend) || 0) > 0 ||
    (Number(safeMetrics.clicks) || 0) > 0

  const prompt = `You are a senior performance marketer reviewing a Meta ad.
Return 3–5 actionable, specific recommendations to improve the ad. Each recommendation
must be concrete (numbers, copy rewrites, audience changes) rather than generic advice.

AD COPY:
- Headline: ${creative.headline ?? ''}
- Primary text: ${creative.primary_text ?? ''}
- Description: ${creative.description ?? ''}
- CTA: ${creative.cta ?? ''}
- Angle: ${creative.angle ?? 'unspecified'}
- Goal: ${creative.goal ?? 'unspecified'}
- Destination type: ${creative.destination_type ?? 'unspecified'}

TARGETING:
${JSON.stringify(creative.audience ?? {}, null, 2)}

BUDGET & SCHEDULE:
${JSON.stringify(creative.budget ?? {}, null, 2)}
Schedule: ${creative.schedule_start ?? ''} → ${creative.schedule_end ?? ''}

CURRENT METRICS (${hasMetrics ? 'from Meta Ads insights' : 'no live metrics yet — use creative analysis only'}):
${JSON.stringify(safeMetrics, null, 2)}

Return ONLY this JSON shape (no markdown, no commentary):
{
  "summary": "1 sentence diagnosis of how this ad is performing or likely to perform.",
  "verdict": "winning" | "underperforming" | "promising" | "needs_review" | "untested",
  "suggestions": [
    {
      "title": "Short imperative title (max 8 words)",
      "category": "copy" | "creative" | "audience" | "budget" | "placement" | "objective",
      "impact": "high" | "medium" | "low",
      "rationale": "1-2 sentences with the metric or principle that backs this up.",
      "action": "Exact change to make. Include numbers and copy rewrites when possible."
    }
  ]
}`

  let parsed: { summary?: string; verdict?: string; suggestions?: unknown[] } = {}
  try {
    const raw = await completeChat({
      messages: [{ role: 'user', content: prompt }],
      jsonMode: true,
      workspaceId: typeof workspace_id === 'string' ? workspace_id : undefined,
      temperature: 0.6,
    })
    parsed = parseJsonFromModel<typeof parsed>(raw)
  } catch (err) {
    return new Response(
      JSON.stringify({
        summary: 'Could not generate AI suggestions right now.',
        verdict: 'needs_review',
        suggestions: [],
        error: err instanceof Error ? err.message : 'AI request failed',
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({
      summary: parsed.summary ?? '',
      verdict: parsed.verdict ?? 'needs_review',
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}))
