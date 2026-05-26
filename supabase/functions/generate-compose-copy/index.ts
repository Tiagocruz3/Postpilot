import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import {
  buildComposeSystemPrompt,
  buildDraftUserPrompt,
  buildPolishUserPrompt,
  clampForPlatform,
  type ComposePlatform,
  sanitizeComposeCopy,
} from '../_shared/compose-ai.ts'
import { completeChat } from '../_shared/ai-complete.ts'

function isPlatform(value: unknown): value is ComposePlatform {
  return value === 'facebook' || value === 'linkedin' || value === 'x'
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}))
    const platform = body.platform
    const mode = body.mode === 'polish' ? 'polish' : 'draft'
    const topic = typeof body.topic === 'string' ? body.topic.trim() : ''
    const draft = typeof body.content === 'string' ? body.content.trim() : ''

    if (!isPlatform(platform)) {
      return new Response(JSON.stringify({ error: 'Invalid platform.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (mode === 'draft' && !topic) {
      return new Response(JSON.stringify({ error: 'Topic is required to draft a post.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (mode === 'polish' && !draft) {
      return new Response(JSON.stringify({ error: 'Post text is required to polish.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const system = buildComposeSystemPrompt(platform)
    const user =
      mode === 'polish' ? buildPolishUserPrompt(platform, draft) : buildDraftUserPrompt(platform, topic)

    const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : undefined
    const raw = await completeChat({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
      workspaceId,
    })
    const content = clampForPlatform(sanitizeComposeCopy(raw), platform)

    return new Response(JSON.stringify({ content }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to generate copy.'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
