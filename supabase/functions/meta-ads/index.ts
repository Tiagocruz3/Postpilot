import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { withCors } from '../_shared/cors.ts'

serve(withCors(async (req) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: { user } } = await supabase.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', '') || '')
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { action, workspace_id, ...params } = body

  const { data: integration } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('user_id', user.id)
    .eq('workspace_id', workspace_id)
    .eq('provider', 'meta')
    .single()

  if (!integration) return new Response('No Meta integration', { status: 400 })
  const token = integration.access_token_encrypted
  const apiBase = 'https://graph.facebook.com/v18.0'

  async function fetchJson(url: string) {
    const res = await fetch(url)
    const json = await res.json()
    return { res, json }
  }

  if (action === 'list_accounts') {
    const { json } = await fetchJson(`${apiBase}/me/adaccounts?access_token=${token}`)
    return new Response(JSON.stringify(json), { headers: { 'Content-Type': 'application/json' } })
  }

  if (action === 'list_campaigns') {
    const { json } = await fetchJson(`${apiBase}/${params.account_id}/campaigns?access_token=${token}`)
    return new Response(JSON.stringify(json), { headers: { 'Content-Type': 'application/json' } })
  }

  if (action === 'list_ads') {
    const accountId = String(params.account_id || '').replace(/^act_/, '')
    if (!accountId) return new Response(JSON.stringify({ error: 'Missing account_id' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

    const { json: adsJson } = await fetchJson(
      `${apiBase}/act_${accountId}/ads?fields=id,name,status,campaign_id,adset_id,creative{id}&limit=50&access_token=${token}`,
    )

    const ads = Array.isArray(adsJson?.data) ? adsJson.data : []
    const campaignFilter = typeof params.campaign_id === 'string' ? params.campaign_id : null
    const filtered = campaignFilter ? ads.filter((a: { campaign_id?: string }) => a?.campaign_id === campaignFilter) : ads

    // Fetch creative thumbnails for a small subset.
    const creativeIds = Array.from(
      new Set(
        filtered
          .map((a: { creative?: { id?: string } }) => a?.creative?.id)
          .filter(Boolean),
      ),
    ).slice(0, 30) as string[]

    const creativeById: Record<string, unknown> = {}
    for (const creativeId of creativeIds) {
      const { json: creativeJson } = await fetchJson(
        `${apiBase}/${creativeId}?fields=thumbnail_url,object_story_spec&thumbnail_width=400&thumbnail_height=400&access_token=${token}`,
      )
      creativeById[creativeId] = creativeJson
    }

    const merged = filtered.map((ad: { creative?: { id?: string } }) => {
      const creativeId = ad?.creative?.id
      const creative = creativeId ? creativeById[creativeId] : null
      return { ...ad, creative }
    })

    return new Response(JSON.stringify({ data: merged }), { headers: { 'Content-Type': 'application/json' } })
  }

  if (action === 'create_campaign') {
    const res = await fetch(`https://graph.facebook.com/v18.0/act_${params.account_id}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: params.name,
        objective: params.objective || 'OUTCOME_AWARENESS',
        status: 'PAUSED',
        special_ad_categories: [],
        access_token: token,
      }),
    })
    return new Response(JSON.stringify(await res.json()), { headers: { 'Content-Type': 'application/json' } })
  }

  if (action === 'create_adset') {
    const res = await fetch(`https://graph.facebook.com/v18.0/${params.campaign_id}/adsets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: params.name,
        optimization_goal: 'REACH',
        billing_event: 'IMPRESSIONS',
        bid_amount: 100,
        daily_budget: params.daily_budget || 1000,
        targeting: { geo_locations: { countries: ['US'] } },
        status: 'PAUSED',
        access_token: token,
      }),
    })
    return new Response(JSON.stringify(await res.json()), { headers: { 'Content-Type': 'application/json' } })
  }

  if (action === 'create_creative') {
    const res = await fetch(`https://graph.facebook.com/v18.0/act_${params.account_id}/adcreatives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: params.name,
        object_story_spec: {
          page_id: integration.metadata?.page_id,
          link_data: {
            message: params.primary_text,
            link: params.link || 'https://example.com',
            name: params.headline,
            description: params.description,
          },
        },
        access_token: token,
      }),
    })
    return new Response(JSON.stringify(await res.json()), { headers: { 'Content-Type': 'application/json' } })
  }

  if (action === 'create_ad') {
    const res = await fetch(`https://graph.facebook.com/v18.0/act_${params.account_id}/ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: params.name,
        adset_id: params.adset_id,
        creative: { creative_id: params.creative_id },
        status: 'PAUSED',
        access_token: token,
      }),
    })
    return new Response(JSON.stringify(await res.json()), { headers: { 'Content-Type': 'application/json' } })
  }

  if (action === 'insights') {
    const fields = [
      'impressions',
      'reach',
      'frequency',
      'clicks',
      'spend',
      'ctr',
      'cpc',
      'cpm',
      'cpp',
      'inline_link_clicks',
      'actions',
      'action_values',
      'video_p25_watched_actions',
      'video_p50_watched_actions',
      'video_p100_watched_actions',
      'website_purchase_roas',
      'purchase_roas',
    ].join(',')
    const datePreset = typeof params.date_preset === 'string' ? params.date_preset : 'last_30d'
    const timeRange =
      params.time_range && typeof params.time_range === 'object'
        ? `&time_range=${encodeURIComponent(JSON.stringify(params.time_range))}`
        : `&date_preset=${encodeURIComponent(datePreset)}`
    const level = typeof params.level === 'string' ? `&level=${encodeURIComponent(params.level)}` : ''
    const breakdowns =
      Array.isArray(params.breakdowns) && params.breakdowns.length > 0
        ? `&breakdowns=${encodeURIComponent(params.breakdowns.join(','))}`
        : ''
    const target = String(params.ad_id || params.adset_id || params.campaign_id || params.account_id || '')
    if (!target) {
      return new Response(JSON.stringify({ error: 'Missing campaign_id / adset_id / ad_id / account_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const targetPath = target.startsWith('act_') ? target : target
    const { json } = await fetchJson(
      `${apiBase}/${targetPath}/insights?fields=${fields}${timeRange}${level}${breakdowns}&access_token=${token}`,
    )
    return new Response(JSON.stringify(json), { headers: { 'Content-Type': 'application/json' } })
  }

  if (action === 'set_ad_status') {
    const { ad_id, status } = params as { ad_id?: string; status?: string }
    if (!ad_id || !status) {
      return new Response(JSON.stringify({ error: 'Missing ad_id or status' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const allowed = new Set(['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED'])
    if (!allowed.has(String(status).toUpperCase())) {
      return new Response(JSON.stringify({ error: `Invalid status ${status}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const res = await fetch(`${apiBase}/${ad_id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: String(status).toUpperCase(), access_token: token }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'set_ad_status failed', detail: json }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Mirror to ad_creatives if a creative_id was provided.
    const creativeId = (params as { creative_id?: string }).creative_id
    if (creativeId) {
      const localStatusMap: Record<string, string> = {
        ACTIVE: 'published',
        PAUSED: 'paused',
        DELETED: 'archived',
        ARCHIVED: 'archived',
      }
      await supabase
        .from('ad_creatives')
        .update({ status: localStatusMap[String(status).toUpperCase()] ?? 'draft' })
        .eq('id', creativeId)
    }
    return new Response(JSON.stringify({ ok: true, ...json }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (action === 'publish_ad') {
    const result = await publishAdFromCreative({
      supabase,
      apiBase,
      token,
      integration,
      params,
    })
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
}))

// --- Publish helpers ---------------------------------------------------------

const OBJECTIVE_MAP: Record<string, string> = {
  'get leads': 'OUTCOME_LEADS',
  'send traffic to website': 'OUTCOME_TRAFFIC',
  'get messages': 'OUTCOME_ENGAGEMENT',
  'increase sales': 'OUTCOME_SALES',
  'boost engagement': 'OUTCOME_ENGAGEMENT',
  'build awareness': 'OUTCOME_AWARENESS',
}

const OPTIMIZATION_FOR_OBJECTIVE: Record<string, string> = {
  OUTCOME_LEADS: 'LEAD_GENERATION',
  OUTCOME_TRAFFIC: 'LINK_CLICKS',
  OUTCOME_ENGAGEMENT: 'POST_ENGAGEMENT',
  OUTCOME_SALES: 'OFFSITE_CONVERSIONS',
  OUTCOME_AWARENESS: 'REACH',
}

const CTA_MAP: Record<string, string> = {
  'learn more': 'LEARN_MORE',
  'shop now': 'SHOP_NOW',
  'sign up': 'SIGN_UP',
  'get offer': 'GET_OFFER',
  'book now': 'BOOK_TRAVEL',
  'get quote': 'GET_QUOTE',
  'message us': 'MESSAGE_PAGE',
  'apply now': 'APPLY_NOW',
}

function mapGoalToObjective(goal: string | null | undefined): string {
  return OBJECTIVE_MAP[(goal ?? '').toLowerCase()] ?? 'OUTCOME_AWARENESS'
}

function mapCta(cta: string | null | undefined): string {
  return CTA_MAP[(cta ?? '').toLowerCase()] ?? 'LEARN_MORE'
}

function mapGenders(genders: string[] | null | undefined): number[] | undefined {
  if (!Array.isArray(genders) || genders.length === 0) return undefined
  const map: Record<string, number> = { men: 1, male: 1, women: 2, female: 2 }
  const out = genders
    .map((g) => map[g.toLowerCase()])
    .filter((value): value is number => value === 1 || value === 2)
  if (out.length === 0 || out.length === 2) return undefined // both = no filter
  return Array.from(new Set(out))
}

function deriveCountry(location: string | null | undefined): string {
  if (!location) return 'US'
  const lower = location.toLowerCase()
  if (/(\bus\b|united states|usa|u\.s\.)/.test(lower)) return 'US'
  if (/(\buk\b|united kingdom|england)/.test(lower)) return 'GB'
  if (/(canada|\bca\b)/.test(lower)) return 'CA'
  if (/australia|\baus?\b/.test(lower)) return 'AU'
  if (/germany|deutsch/.test(lower)) return 'DE'
  if (/france|\bfr\b/.test(lower)) return 'FR'
  if (/spain|españa|\besp?\b/.test(lower)) return 'ES'
  if (/italy|italia/.test(lower)) return 'IT'
  if (/india|\bin\b/.test(lower)) return 'IN'
  return 'US'
}

function buildTargeting(audience: Record<string, unknown> | null | undefined, placements: string[] | null | undefined) {
  const a = audience ?? {}
  const targeting: Record<string, unknown> = {
    geo_locations: { countries: [deriveCountry(a.location as string | undefined)] },
  }
  const ageMin = Number(a.age_min ?? 0)
  const ageMax = Number(a.age_max ?? 0)
  if (ageMin > 12) targeting.age_min = Math.max(13, ageMin)
  if (ageMax > 12) targeting.age_max = Math.min(65, ageMax)
  const genders = mapGenders(a.genders as string[] | undefined)
  if (genders) targeting.genders = genders

  if (Array.isArray(placements) && placements.length > 0) {
    const ps = placements.map((p) => p.toLowerCase())
    const platforms: string[] = []
    if (ps.some((p) => p.includes('facebook'))) platforms.push('facebook')
    if (ps.some((p) => p.includes('instagram') || p.includes('reel') || p.includes('story'))) platforms.push('instagram')
    if (platforms.length > 0) targeting.publisher_platforms = Array.from(new Set(platforms))
  }
  return targeting
}

async function uploadAdImage(apiBase: string, accountId: string, token: string, url: string): Promise<string | null> {
  try {
    const res = await fetch(`${apiBase}/act_${accountId}/adimages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url, access_token: token }),
    })
    const json = (await res.json().catch(() => ({}))) as { images?: Record<string, { hash?: string }> }
    if (!res.ok) {
      console.warn('[meta-ads] adimages upload failed', json)
      return null
    }
    const first = Object.keys(json.images ?? {})[0]
    return (first && json.images?.[first]?.hash) || null
  } catch (err) {
    console.warn('[meta-ads] uploadAdImage error', err)
    return null
  }
}

type PublishParams = {
  supabase: ReturnType<typeof createClient>
  apiBase: string
  token: string
  integration: { metadata?: { page_id?: string } | null }
  params: Record<string, unknown>
}

async function publishAdFromCreative({ supabase, apiBase, token, integration, params }: PublishParams) {
  const creativeId = String(params.creative_id || '')
  const rawAccountId = String(params.account_id || '')
  if (!creativeId) return { status: 400, body: { error: 'Missing creative_id' } }
  if (!rawAccountId) return { status: 400, body: { error: 'Missing account_id' } }
  const accountId = rawAccountId.replace(/^act_/, '')
  const pageId = integration.metadata?.page_id
  if (!pageId) return { status: 400, body: { error: 'No Facebook page connected. Connect a page in Settings.' } }

  const { data: creative, error: creativeError } = await supabase
    .from('ad_creatives')
    .select('*')
    .eq('id', creativeId)
    .single()
  if (creativeError || !creative) {
    return { status: 404, body: { error: 'Ad creative not found', detail: creativeError } }
  }
  const c = creative as Record<string, unknown>
  const audience = (c.audience as Record<string, unknown> | null) ?? {}
  const budget = (c.budget as Record<string, unknown> | null) ?? {}

  // 1. Upload image (videos skipped in v1 — Meta video upload is async + polling-heavy)
  let imageHash: string | null = null
  if (c.media_url && c.media_type === 'image') {
    imageHash = await uploadAdImage(apiBase, accountId, token, String(c.media_url))
  }

  // 2. Campaign
  let campaignId = (c.meta_campaign_id as string | null) || null
  const objective = mapGoalToObjective(c.goal as string | null)
  if (!campaignId) {
    const campRes = await fetch(`${apiBase}/act_${accountId}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: c.campaign_name || c.headline || 'Postpilot campaign',
        objective,
        status: 'PAUSED',
        special_ad_categories: [],
        access_token: token,
      }),
    })
    const campJson = (await campRes.json().catch(() => ({}))) as { id?: string; error?: unknown }
    if (!campRes.ok || !campJson.id) {
      return { status: 502, body: { error: 'Failed to create campaign', detail: campJson } }
    }
    campaignId = campJson.id
  }

  // 3. Adset
  let adsetId = (c.meta_adset_id as string | null) || null
  if (!adsetId) {
    const dailyBudgetCents = Math.max(100, Math.round(Number(budget.daily ?? 0) * 100)) // Meta min ~$1
    const lifetimeBudgetCents = Math.round(Number(budget.lifetime ?? 0) * 100)
    const useLifetime = budget.type === 'lifetime' && lifetimeBudgetCents > 0
    const optimization = OPTIMIZATION_FOR_OBJECTIVE[objective] ?? 'REACH'

    const targeting = buildTargeting(audience, (c.placements as string[]) ?? null)
    const adsetPayload: Record<string, unknown> = {
      name: `${c.campaign_name || c.headline || 'Ad'} — Ad set`,
      campaign_id: campaignId,
      optimization_goal: optimization,
      billing_event: 'IMPRESSIONS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting,
      status: 'PAUSED',
      access_token: token,
    }
    if (useLifetime) {
      adsetPayload.lifetime_budget = lifetimeBudgetCents
      if (c.schedule_start) adsetPayload.start_time = c.schedule_start
      if (c.schedule_end) adsetPayload.end_time = c.schedule_end
    } else {
      adsetPayload.daily_budget = dailyBudgetCents
      if (c.schedule_start) adsetPayload.start_time = c.schedule_start
    }

    const adsetRes = await fetch(`${apiBase}/act_${accountId}/adsets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adsetPayload),
    })
    const adsetJson = (await adsetRes.json().catch(() => ({}))) as { id?: string; error?: unknown }
    if (!adsetRes.ok || !adsetJson.id) {
      return { status: 502, body: { error: 'Failed to create ad set', detail: adsetJson } }
    }
    adsetId = adsetJson.id
  }

  // 4. Ad creative
  const linkData: Record<string, unknown> = {
    message: c.primary_text,
    link: c.destination_url || 'https://example.com',
    name: c.headline,
    description: c.description ?? undefined,
    call_to_action: { type: mapCta(c.cta as string | null) },
  }
  if (imageHash) linkData.image_hash = imageHash

  const creativeRes = await fetch(`${apiBase}/act_${accountId}/adcreatives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${c.headline || 'Ad'} creative`,
      object_story_spec: { page_id: pageId, link_data: linkData },
      access_token: token,
    }),
  })
  const creativeJson = (await creativeRes.json().catch(() => ({}))) as { id?: string; error?: unknown }
  if (!creativeRes.ok || !creativeJson.id) {
    return { status: 502, body: { error: 'Failed to create ad creative', detail: creativeJson } }
  }

  // 5. Ad
  const adRes = await fetch(`${apiBase}/act_${accountId}/ads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: c.campaign_name || c.headline || 'Postpilot ad',
      adset_id: adsetId,
      creative: { creative_id: creativeJson.id },
      status: 'PAUSED',
      access_token: token,
    }),
  })
  const adJson = (await adRes.json().catch(() => ({}))) as { id?: string; error?: unknown }
  if (!adRes.ok || !adJson.id) {
    return { status: 502, body: { error: 'Failed to create ad', detail: adJson } }
  }

  // 6. Persist back to ad_creatives
  await supabase
    .from('ad_creatives')
    .update({
      meta_campaign_id: campaignId,
      meta_adset_id: adsetId,
      meta_ad_id: adJson.id,
      status: 'paused', // safety: created as PAUSED on Meta — user activates explicitly
      published_at: new Date().toISOString(),
    })
    .eq('id', creativeId)

  return {
    status: 200,
    body: {
      ok: true,
      campaign_id: campaignId,
      adset_id: adsetId,
      ad_id: adJson.id,
      uploaded_image: Boolean(imageHash),
      warnings: c.media_type === 'video' ? ['Video upload not yet supported — ad created without media. Add the video in Meta Ads Manager.'] : [],
    },
  }
}
