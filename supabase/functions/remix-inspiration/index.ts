import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { sanitizeComposeCopy, type ComposePlatform } from '../_shared/compose-ai.ts'
import { completeChat, parseJsonFromModel } from '../_shared/ai-complete.ts'
import {
  buildInspirationSystemPrompt,
  buildInspirationUserPrompt,
  type RemixInput,
} from '../_shared/post-intelligence-prompts.ts'
import { withCors } from '../_shared/cors.ts'

function isPlatform(value: unknown): value is ComposePlatform {
  return value === 'facebook' || value === 'linkedin' || value === 'x'
}

serve(withCors(async (req) => {
  try {
    const body = await req.json().catch(() => ({}))
    const original_post_text = typeof body.original_post_text === 'string' ? body.original_post_text.trim() : ''

    if (!original_post_text) {
      return new Response(JSON.stringify({ error: 'Original post text is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const platform = isPlatform(body.platform) ? body.platform : 'facebook'
    const input: RemixInput = {
      original_post_text,
      platform,
      competitor_niche: typeof body.competitor_niche === 'string' ? body.competitor_niche : 'Unknown',
      brand_name: typeof body.brand_name === 'string' ? body.brand_name : 'Brand',
      user_niche: typeof body.user_niche === 'string' ? body.user_niche : 'General',
      target_audience: typeof body.target_audience === 'string' ? body.target_audience : 'General audience',
      tone: typeof body.tone === 'string' ? body.tone : 'Professional and friendly',
      offer: typeof body.offer === 'string' ? body.offer : 'Not specified',
      post_goal: typeof body.post_goal === 'string' ? body.post_goal : 'Engagement',
    }
    const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : undefined

    const raw = await completeChat({
      messages: [
        { role: 'system', content: buildInspirationSystemPrompt() },
        { role: 'user', content: buildInspirationUserPrompt(input) },
      ],
      jsonMode: true,
      temperature: 0.65,
      workspaceId,
    })

    const report = parseJsonFromModel<Record<string, unknown>>(raw)
    for (const key of ['caption', 'brand_safe_version'] as const) {
      if (typeof report[key] === 'string') {
        report[key] = sanitizeComposeCopy(report[key])
      }
    }

    return new Response(JSON.stringify({ report }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Remix failed.'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}))
