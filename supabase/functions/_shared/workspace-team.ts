import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export async function requireWorkspaceAdmin(
  admin: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const { data: workspace } = await admin
    .from('workspaces')
    .select('owner_id')
    .eq('id', workspaceId)
    .maybeSingle()

  if (workspace?.owner_id === userId) {
    return true
  }

  const { data: membership } = await admin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  return membership?.role === 'owner' || membership?.role === 'admin'
}

export function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
