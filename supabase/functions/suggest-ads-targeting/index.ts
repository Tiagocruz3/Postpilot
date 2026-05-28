import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { completeChat, parseJsonFromModel } from '../_shared/ai-complete.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const body = await req.json().catch(() => ({}))
  const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : undefined
  const business = body.business_profile ?? {}
  const offer = body.offer_profile ?? {}
  const goal = typeof body.goal === 'string' ? body.goal : 'Build awareness'

  const prompt = `You are a Meta Ads targeting specialist. Suggest a practical Facebook/Instagram ad audience.

Business: ${business.businessName || 'Unknown'}
Industry: ${business.industry || 'Unknown'}
Website: ${business.websiteUrl || 'N/A'}
Product/service: ${offer.mainProductService || 'Unknown'}
Main offer: ${offer.mainOffer || 'Unknown'}
Problem solved: ${offer.customerProblemSolved || 'Unknown'}
Campaign goal: ${goal}

Return ONLY JSON:
{
  "audience_description": "2-3 sentences describing who to target",
  "locations": "one location label e.g. Brisbane, Australia",
  "age_range": "e.g. 25-54",
  "gender": "All | Women | Men",
  "interests": ["5-8 interest labels similar to Meta Ads Manager interests"],
  "pain_points": "short bullet-style sentence",
  "desired_outcome": "what they should do after seeing the ad",
  "ai_tip": "one sentence of practical Meta Ads advice for this business"
}`

  try {
    const raw = await completeChat({
      messages: [{ role: 'user', content: prompt }],
      jsonMode: true,
      workspaceId,
      temperature: 0.5,
    })
    const parsed = parseJsonFromModel<Record<string, unknown>>(raw)
    return new Response(JSON.stringify({ success: true, ...parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not suggest audience.'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
