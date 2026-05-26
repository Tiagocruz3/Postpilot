import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

serve(async (req) => {
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

  if (action === 'list_accounts') {
    const res = await fetch(`https://graph.facebook.com/v18.0/me/adaccounts?access_token=${token}`)
    return new Response(JSON.stringify(await res.json()), { headers: { 'Content-Type': 'application/json' } })
  }

  if (action === 'list_campaigns') {
    const res = await fetch(`https://graph.facebook.com/v18.0/${params.account_id}/campaigns?access_token=${token}`)
    return new Response(JSON.stringify(await res.json()), { headers: { 'Content-Type': 'application/json' } })
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
    const res = await fetch(`https://graph.facebook.com/v18.0/${params.campaign_id}/insights?fields=impressions,clicks,spend,ctr,cpc,roas&access_token=${token}`)
    return new Response(JSON.stringify(await res.json()), { headers: { 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
})
