import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

serve(async (req) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: { user } } = await supabase.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', '') || '')
  if (!user) return new Response('Unauthorized', { status: 401 })

  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspace_id')

  await supabase.from('user_integrations').delete()
    .eq('user_id', user.id)
    .eq('workspace_id', workspaceId)
    .eq('provider', 'google')

  await supabase.from('planner_tasks').delete()
    .eq('workspace_id', workspaceId)
    .eq('external_source', 'google-calendar')

  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } })
})
