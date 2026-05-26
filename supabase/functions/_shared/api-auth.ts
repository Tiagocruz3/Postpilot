import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

export async function resolveRequestUserId(
  req: Request,
  supabase: SupabaseClient,
  taskId?: string
): Promise<string | null> {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  if (token && token === serviceKey) {
    if (!taskId) {
      return null
    }

    const { data: task } = await supabase.from('planner_tasks').select('user_id').eq('id', taskId).single()
    return task?.user_id ?? null
  }

  if (!token) {
    return null
  }

  const { data: { user } } = await supabase.auth.getUser(token)
  return user?.id ?? null
}
