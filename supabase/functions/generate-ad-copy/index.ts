import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { completeChat, parseJsonFromModel } from '../_shared/ai-complete.ts'
import { withCors } from '../_shared/cors.ts'

serve(withCors(async (req) => {
  const body = await req.json().catch(() => ({}))
  const { brief, workspace_id } = body

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: onboarding } = await supabase
    .from('meta_ads_onboarding')
    .select('answers')
    .eq('workspace_id', workspace_id)
    .single()

  const answers = onboarding?.answers || {}
  const prompt = `You are a senior performance marketer. Create 3 Facebook ad variants for this brief: "${brief}".
Brand voice: ${answers.brand_voice || 'professional'}.
Goal: ${answers.goal || 'awareness'}.
Audience: ${answers.audience || 'general'}.
Return ONLY a JSON array with objects: {headline, primary_text, description, cta, image_prompt}.`

  const raw = await completeChat({
    messages: [{ role: 'user', content: prompt }],
    jsonMode: true,
    workspaceId: typeof workspace_id === 'string' ? workspace_id : undefined,
    temperature: 0.7,
  })
  let variants: unknown[] = []
  try {
    const parsed = parseJsonFromModel<Record<string, unknown> | unknown[]>(raw)
    variants = Array.isArray(parsed) ? parsed : parsed.variants || []
  } catch {
    variants = []
  }

  return new Response(JSON.stringify({ variants }), { headers: { 'Content-Type': 'application/json' } })
}))
