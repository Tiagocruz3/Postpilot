import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { corsHeaders, jsonResponse, requireWorkspaceAdmin } from '../_shared/workspace-team.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
  } = await userClient.auth.getUser()

  if (!user) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const body = await req.json().catch(() => ({}))
  const workspaceId = body.workspace_id as string | undefined
  const memberUserId = body.user_id as string | undefined
  const inviteId = body.invite_id as string | undefined

  if (!workspaceId) {
    return jsonResponse({ error: 'workspace_id is required' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const canManage = await requireWorkspaceAdmin(admin, workspaceId, user.id)

  if (!canManage) {
    return jsonResponse({ error: 'Only workspace owners and admins can remove members' }, 403)
  }

  if (inviteId) {
    const { error } = await admin
      .from('workspace_invites')
      .delete()
      .eq('id', inviteId)
      .eq('workspace_id', workspaceId)

    if (error) {
      return jsonResponse({ error: error.message }, 500)
    }

    return jsonResponse({ status: 'invite_removed' })
  }

  if (!memberUserId) {
    return jsonResponse({ error: 'user_id or invite_id is required' }, 400)
  }

  const { data: targetMember } = await admin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', memberUserId)
    .maybeSingle()

  if (targetMember?.role === 'owner') {
    return jsonResponse({ error: 'Cannot remove the workspace owner' }, 400)
  }

  const { error } = await admin
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', memberUserId)

  if (error) {
    return jsonResponse({ error: error.message }, 500)
  }

  return jsonResponse({ status: 'member_removed', user_id: memberUserId })
})
