import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { completeChat, parseJsonFromModel } from '../_shared/ai-complete.ts'
import { withCors } from '../_shared/cors.ts'

serve(withCors(async (req) => {
  const body = await req.json().catch(() => ({}))
  const { brief, workspace_id, regenerate_variant_index } = body

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: onboarding } = await supabase
    .from('meta_ads_onboarding')
    .select('answers')
    .eq('workspace_id', workspace_id)
    .single()

  const answers = onboarding?.answers || {}
  const businessProfile = answers.businessProfile || answers.business_profile || {}
  const offerProfile = answers.offerProfile || answers.offer_profile || {}
  const audienceProfile = answers.audienceProfile || answers.audience_profile || {}
  const brandVoice = answers.brandVoice || answers.brand_voice || {}
  const goal = answers.goal || 'awareness'
  const audience = answers.audience || audienceProfile.description || 'general audience'
  const tone = brandVoice.tone || answers.brand_voice || 'professional'
  const variantsToReturn = typeof regenerate_variant_index === 'number' ? 1 : 2

  const prompt = `You are a senior Meta Ads copywriter and creative strategist.
Create ${variantsToReturn} STRUCTURALLY DISTINCT Facebook/Instagram ad variants for this brief.

Writing rules:
- NEVER use em dashes or en dashes (— or –). Use a comma, period, or a plain hyphen (-) instead.
- Format "primary_text" as 2-3 short, scannable paragraphs separated by a blank line (\n\n). Keep paragraphs to 1-2 sentences. Do NOT return one long run-on block.

Brief: "${brief}"

Brand & audience context:
- Business: ${businessProfile.businessName || 'Unknown'}
- Industry: ${businessProfile.industry || 'Unknown'}
- Main offer: ${offerProfile.mainOffer || 'Unknown'}
- Product/service: ${offerProfile.mainProductService || 'Unknown'}
- Audience: ${audience}
- Pain points: ${audienceProfile.painPoints || 'Unknown'}
- Tone: ${tone}
- Goal: ${goal}

Hard requirements for the variants:
${variantsToReturn === 2 ? `
- Variant A and Variant B MUST use different creative angles. Examples of angles to choose
  from (pick two different ones): direct-offer, problem-then-solution, social-proof, urgency,
  curiosity-question, story-driven, founder-voice, comparison.
- Different headlines (no shared phrases).
- Different primary text (different opening hook, different structure).
- Different description (sub-text under the headline).
- Different CTA from this list: Learn More, Shop Now, Sign Up, Get Offer, Book Now, Get Quote, Message Us, Apply Now.
- Different "image_prompt" — describe a different shot composition, mood, and subject.
- Different "creative_direction" — short note describing the visual angle.
- Different "targeting_angle" — short note describing who responds best to this variant.
` : `
- Produce ONE fresh variant with a brand new angle, NOT a paraphrase of the brief.
`}

Also include a "recommendation" object naming which variant you predict will perform
better and explaining WHY in one sentence.

Return ONLY a JSON object exactly matching this schema (no markdown, no commentary):
{
  "variants": [
    {
      "name": "Variant A",
      "angle": "direct-offer | problem-solution | social-proof | urgency | curiosity | story | founder | comparison",
      "headline": "5-8 words max, punchy",
      "primary_text": "2-3 short paragraphs separated by a blank line (\\n\\n), 1-2 sentences each, no emojis unless they fit the tone",
      "description": "8-14 words, supports the headline",
      "cta": "Learn More | Shop Now | Sign Up | Get Offer | Book Now | Get Quote | Message Us | Apply Now",
      "image_prompt": "1-2 sentences describing a shot we could generate",
      "creative_direction": "1 sentence on visual direction",
      "targeting_angle": "1 sentence on audience this variant resonates with"
    }
  ],
  "recommendation": {
    "preferred_variant": "Variant A | Variant B",
    "reason": "1 sentence explaining why this variant should perform better"
  }
}`

  const raw = await completeChat({
    messages: [{ role: 'user', content: prompt }],
    jsonMode: true,
    workspaceId: typeof workspace_id === 'string' ? workspace_id : undefined,
    temperature: 0.85,
  })

  let variants: unknown[] = []
  let recommendation: unknown = null
  try {
    const parsed = parseJsonFromModel<Record<string, unknown> | unknown[]>(raw)
    if (Array.isArray(parsed)) {
      variants = parsed
    } else {
      variants = Array.isArray(parsed.variants) ? (parsed.variants as unknown[]) : []
      recommendation = parsed.recommendation ?? null
    }
  } catch {
    variants = []
  }

  return new Response(JSON.stringify({ variants, recommendation }), {
    headers: { 'Content-Type': 'application/json' },
  })
}))
