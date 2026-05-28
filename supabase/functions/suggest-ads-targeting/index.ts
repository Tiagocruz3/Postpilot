import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { completeChat, parseJsonFromModel } from '../_shared/ai-complete.ts'
import { withCors } from '../_shared/cors.ts'

serve(withCors(async (req) => {
  const body = await req.json().catch(() => ({}))
  const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : undefined
  const business = body.business_profile ?? {}
  const offer = body.offer_profile ?? {}
  const goal = typeof body.goal === 'string' ? body.goal : 'Build awareness'

  const prompt = `You are a senior Meta Ads strategist. Recommend a complete, realistic targeting plan
for a Facebook/Instagram campaign. Output MUST be a single JSON object exactly matching the schema.

Business: ${business.businessName || 'Unknown'}
Industry: ${business.industry || 'Unknown'}
Website: ${business.websiteUrl || 'N/A'}
Product/service: ${offer.mainProductService || 'Unknown'}
Main offer: ${offer.mainOffer || 'Unknown'}
Problem solved: ${offer.customerProblemSolved || 'Unknown'}
Campaign goal: ${goal}

For every recommendation field, also produce a "reason" written in plain English explaining WHY
that recommendation makes sense for this specific business, offer, goal, and location.

Return ONLY JSON in this exact shape — no markdown, no commentary:
{
  "audience_description": "2-3 sentences describing who to target",
  "locations": "one location label e.g. Brisbane, Australia",
  "age_range": "e.g. 25-54",
  "age_min": 25,
  "age_max": 54,
  "gender": "All | Women | Men",
  "interests": ["5-8 interest labels similar to Meta Ads Manager interests"],
  "behaviours": ["3-5 behaviour segments such as 'Recently moved', 'Engaged shoppers'"],
  "audience_size": "narrow | balanced | broad",
  "objective": "Get leads | Send traffic to website | Get messages | Increase sales | Boost engagement | Build awareness",
  "placements": "advantage | feed | stories | feed_stories",
  "ad_format": "Single Image Ad | Video Ad | Carousel Ad | Story / Reel Ad | Lead Form Ad | Website Conversion Ad | Engagement Ad",
  "daily_budget": 35,
  "lifetime_budget": 500,
  "duration_days": 7,
  "pain_points": "short bullet-style sentence",
  "desired_outcome": "what they should do after seeing the ad",
  "ai_tip": "one sentence of practical Meta Ads advice for this business",
  "reasons": {
    "age": "why this age range",
    "gender": "why this gender split (or all)",
    "locations": "why this location",
    "interests": "why these interest groups",
    "behaviours": "why these behaviours",
    "audience_size": "why narrow/balanced/broad",
    "objective": "why this objective for this business",
    "placements": "why these placements",
    "budget": "why this starting budget and duration"
  }
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
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not suggest audience.'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}))
