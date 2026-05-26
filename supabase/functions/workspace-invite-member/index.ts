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
  const email = (body.email as string | undefined)?.trim().toLowerCase()
  const role = body.role === 'admin' ? 'admin' : 'member'

  if (!workspaceId || !email) {
    return jsonResponse({ error: 'workspace_id and email are required' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const canInvite = await requireWorkspaceAdmin(admin, workspaceId, user.id)

  if (!canInvite) {
    return jsonResponse({ error: 'Only workspace owners and admins can invite members' }, 403)
  }

  const { data: targetUserId, error: lookupError } = await admin.rpc('get_auth_user_id_by_email', {
    p_email: email,
  })

  if (lookupError) {
    return jsonResponse({ error: lookupError.message }, 500)
  }

  if (targetUserId) {
    if (targetUserId === user.id && role === 'member') {
      return jsonResponse({ error: 'You are already in this workspace' }, 400)
    }

    const { error: memberError } = await admin.from('workspace_members').upsert(
      {
        workspace_id: workspaceId,
        user_id: targetUserId,
        role,
      },
      { onConflict: 'workspace_id,user_id' }
    )

    if (memberError) {
      return jsonResponse({ error: memberError.message }, 500)
    }

    await admin
      .from('workspace_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .eq('email', email)

    return jsonResponse({ status: 'added', user_id: targetUserId, email, role })
  }

  const { error: inviteError } = await admin.from('workspace_invites').upsert(
    {
      workspace_id: workspaceId,
      email,
      role,
      invited_by: user.id,
      accepted_at: null,
    },
    { onConflict: 'workspace_id,email' }
  )

  if (inviteError) {
    return jsonResponse({ error: inviteError.message }, 500)
  }

  return jsonResponse({
    status: 'invited',
    email,
    role,
    message: 'Invite saved. They will join this workspace when they sign up with this email.',
  })
})
