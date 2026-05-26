import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

serve(async (req) => {
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

  const aiRes = await fetch(`${Deno.env.get('LOVABLE_AI_URL') || 'https://ai.lovable.dev/v1'}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  })

  const aiData = await aiRes.json()
  let variants: any[] = []
  try {
    const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || '[]')
    variants = Array.isArray(parsed) ? parsed : parsed.variants || []
  } catch {
    variants = []
  }

  return new Response(JSON.stringify({ variants }), { headers: { 'Content-Type': 'application/json' } })
})
