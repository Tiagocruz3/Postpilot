import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { completeChat, parseJsonFromModel } from '../_shared/ai-complete.ts'
import {
  buildResearcherSystemPrompt,
  buildResearcherUserPrompt,
  type ResearchInput,
} from '../_shared/post-intelligence-prompts.ts'
import { sanitizeComposeCopy, type ComposePlatform } from '../_shared/compose-ai.ts'

function isPlatform(value: unknown): value is ComposePlatform {
  return value === 'facebook' || value === 'linkedin' || value === 'x'
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}))

    const topic = typeof body.topic === 'string' ? body.topic.trim() : ''
    if (!topic) {
      return new Response(JSON.stringify({ error: 'Topic is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const platform = isPlatform(body.platform) ? body.platform : 'facebook'
    const input: ResearchInput = {
      brand_name: typeof body.brand_name === 'string' ? body.brand_name : 'Brand',
      niche: typeof body.niche === 'string' ? body.niche : 'General',
      topic,
      platform,
      target_audience: typeof body.target_audience === 'string' ? body.target_audience : 'General audience',
      tone: typeof body.tone === 'string' ? body.tone : 'Professional and friendly',
      post_goal: typeof body.post_goal === 'string' ? body.post_goal : 'Engagement',
      location_optional: typeof body.location === 'string' ? body.location : undefined,
      web_search_enabled: body.web_search === true,
    }
    const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : undefined

    const raw = await completeChat({
      messages: [
        { role: 'system', content: buildResearcherSystemPrompt() },
        { role: 'user', content: buildResearcherUserPrompt(input) },
      ],
      jsonMode: true,
      webSearch: input.web_search_enabled,
      temperature: 0.5,
      workspaceId,
    })

    const report = parseJsonFromModel<Record<string, unknown>>(raw)
    if (typeof report.caption_draft === 'string') {
      report.caption_draft = sanitizeComposeCopy(report.caption_draft)
    }

    return new Response(JSON.stringify({ report }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Research failed.'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
