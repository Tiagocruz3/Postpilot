import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { withCors } from '../_shared/cors.ts'

serve(withCors(async (req) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: { user } } = await supabase.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', '') || '')
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: integration } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .single()

  if (!integration) return new Response('No integration', { status: 400 })

  const calendarRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${integration.access_token_encrypted}` },
  })
  const calendars = await calendarRes.json()

  for (const cal of calendars.items || []) {
    const eventsRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${new Date().toISOString()}&singleEvents=true&orderBy=startTime`, {
      headers: { Authorization: `Bearer ${integration.access_token_encrypted}` },
    })
    const events = await eventsRes.json()

    for (const evt of events.items || []) {
      const existing = await supabase
        .from('planner_tasks')
        .select('id')
        .eq('external_id', evt.id)
        .eq('workspace_id', integration.workspace_id)
        .single()

      const payload = {
        workspace_id: integration.workspace_id,
        user_id: user.id,
        title: evt.summary || 'Untitled',
        description: evt.description || '',
        scheduled_at: evt.start.dateTime || `${evt.start.date}T00:00:00`,
        duration_minutes: 60,
        status: 'scheduled',
        kind: 'event',
        external_source: 'google-calendar',
        external_id: evt.id,
        external_calendar_id: cal.id,
        color: cal.backgroundColor,
      }

      if (existing.data) {
        await supabase.from('planner_tasks').update(payload).eq('id', existing.data.id)
      } else {
        await supabase.from('planner_tasks').insert(payload)
      }
    }
  }

  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } })
}))
