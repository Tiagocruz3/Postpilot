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

  return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
}))
