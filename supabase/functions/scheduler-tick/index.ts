import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

serve(async (req) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const now = new Date().toISOString()
  const { data: tasks } = await supabase
    .from('planner_tasks')
    .select('*, scheduled_posts(*)')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(50)

  for (const task of tasks || []) {
    const post = task.scheduled_posts?.[0]
    if (!post) continue

    const platform = task.platform
    try {
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/${platform}-api`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: task.id,
          content: post.content,
          media_urls: post.media_urls,
          media_types: (task.payload as { media_types?: string[] } | null)?.media_types ?? [],
        }),
      })

      if (!res.ok) throw new Error(await res.text())
    } catch (err: any) {
      await supabase.from('planner_tasks').update({ status: 'failed' }).eq('id', task.id)
      await supabase.from('scheduled_posts').update({ error: err.message }).eq('id', post.id)
    }
  }

  return new Response(JSON.stringify({ processed: tasks?.length || 0 }), { headers: { 'Content-Type': 'application/json' } })
})
