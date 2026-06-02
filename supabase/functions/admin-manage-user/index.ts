import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { withCors } from '../_shared/cors.ts'

/**
 * Admin-only edge function for managing platform users from the Admin Panel.
 *
 * Supported actions (POST `body.action`):
 *   - `create`: create a new auth user already email-confirmed, set their
 *               profile display name, role, and membership plan.
 *   - `delete`: delete the auth user (cascades through profile + related rows).
 *   - `set_password`: directly set a new password for a user (admin override).
 *   - `send_recovery`: generate a password-recovery link for a user and (when
 *                      SMTP is configured) email it. The link is also returned
 *                      so the admin can share it manually.
 *
 * Caller must be a platform admin (verified via `is_platform_admin` RPC). All
 * privileged auth + DB writes happen with the service-role key on the server.
 */

type CreateUserBody = {
  action: 'create'
  email: string
  password: string
  name?: string
  role?: 'admin' | 'member'
  plan?: string
  subscription_status?: string
}

type DeleteUserBody = {
  action: 'delete'
  user_id: string
}

type SetPasswordBody = {
  action: 'set_password'
  user_id: string
  password: string
}

type SendRecoveryBody = {
  action: 'send_recovery'
  user_id?: string
  email?: string
  redirect_to?: string
}

type Body = CreateUserBody | DeleteUserBody | SetPasswordBody | SendRecoveryBody

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

serve(
  withCors(async (req) => {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user: caller },
    } = await userClient.auth.getUser()
    if (!caller) return jsonResponse({ error: 'Unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: isAdmin, error: adminCheckError } = await admin.rpc('is_platform_admin', {
      p_user_id: caller.id,
    })
    if (adminCheckError) return jsonResponse({ error: adminCheckError.message }, 500)
    if (!isAdmin) return jsonResponse({ error: 'Forbidden' }, 403)

    const body = (await req.json().catch(() => null)) as Body | null
    if (!body || !body.action) return jsonResponse({ error: 'Missing action' }, 400)

    if (body.action === 'create') {
      const email = body.email?.trim().toLowerCase()
      const password = body.password
      if (!email || !password) {
        return jsonResponse({ error: 'email and password are required' }, 400)
      }
      if (password.length < 8) {
        return jsonResponse({ error: 'Password must be at least 8 characters' }, 400)
      }

      const displayName = body.name?.trim() || email.split('@')[0]
      const role = body.role === 'admin' ? 'admin' : 'member'
      const plan = (body.plan ?? 'free').trim() || 'free'
      const subscriptionStatus = body.subscription_status ?? 'active'

      // Refuse duplicates up front for a friendly message.
      const { data: existingId } = await admin.rpc('get_auth_user_id_by_email', { p_email: email })
      if (existingId) return jsonResponse({ error: 'A user with this email already exists' }, 409)

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName, full_name: displayName, name: displayName },
      })
      if (createError || !created.user) {
        return jsonResponse({ error: createError?.message ?? 'Failed to create user' }, 500)
      }

      const newUserId = created.user.id

      // Profile row may have been auto-created by a trigger; upsert to ensure
      // display_name is set even if the trigger hasn't run.
      await admin.from('profiles').upsert(
        { id: newUserId, display_name: displayName },
        { onConflict: 'id' },
      )

      const { error: provisionError } = await admin.rpc('admin_provision_user', {
        p_user_id: newUserId,
        p_role: role,
        p_plan: plan,
        p_subscription_status: subscriptionStatus,
      })
      if (provisionError) {
        // Best-effort rollback so we don't leave a half-provisioned user.
        await admin.auth.admin.deleteUser(newUserId).catch(() => {})
        return jsonResponse({ error: provisionError.message }, 500)
      }

      await writeAudit(admin, caller.id, caller.email ?? 'unknown', 'create_user', newUserId, {
        email,
        role,
        plan,
        subscription_status: subscriptionStatus,
      })

      return jsonResponse({
        status: 'created',
        user_id: newUserId,
        email,
        role,
        plan,
      })
    }

    if (body.action === 'delete') {
      const userId = body.user_id
      if (!userId) return jsonResponse({ error: 'user_id is required' }, 400)
      if (userId === caller.id) {
        return jsonResponse({ error: 'You cannot delete your own admin account' }, 400)
      }

      // Snapshot the user's email/profile before deletion for the audit row.
      const { data: existingUser } = await admin.auth.admin.getUserById(userId)
      const targetEmail = existingUser?.user?.email ?? null

      const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
      if (deleteError) return jsonResponse({ error: deleteError.message }, 500)

      await writeAudit(admin, caller.id, caller.email ?? 'unknown', 'delete_user', userId, {
        email: targetEmail,
      })

      return jsonResponse({ status: 'deleted', user_id: userId })
    }

    if (body.action === 'set_password') {
      const userId = body.user_id
      const password = body.password
      if (!userId) return jsonResponse({ error: 'user_id is required' }, 400)
      if (!password || password.length < 8) {
        return jsonResponse({ error: 'Password must be at least 8 characters' }, 400)
      }

      const { data: existingUser } = await admin.auth.admin.getUserById(userId)
      const targetEmail = existingUser?.user?.email ?? null

      const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password })
      if (updateError) return jsonResponse({ error: updateError.message }, 500)

      await writeAudit(admin, caller.id, caller.email ?? 'unknown', 'set_password', userId, {
        email: targetEmail,
      })

      return jsonResponse({ status: 'password_set', user_id: userId, email: targetEmail })
    }

    if (body.action === 'send_recovery') {
      let email = body.email?.trim().toLowerCase() ?? null
      if (!email && body.user_id) {
        const { data: existingUser } = await admin.auth.admin.getUserById(body.user_id)
        email = existingUser?.user?.email ?? null
      }
      if (!email) return jsonResponse({ error: 'A user email is required' }, 400)

      const redirectTo = body.redirect_to || undefined
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: redirectTo ? { redirectTo } : undefined,
      })
      if (linkError) return jsonResponse({ error: linkError.message }, 500)

      const actionLink = linkData?.properties?.action_link ?? null

      await writeAudit(admin, caller.id, caller.email ?? 'unknown', 'send_recovery', body.user_id ?? email, {
        email,
      })

      return jsonResponse({ status: 'recovery_sent', email, action_link: actionLink })
    }

    return jsonResponse({ error: 'Unknown action' }, 400)
  }),
)

async function writeAudit(
  admin: ReturnType<typeof createClient>,
  adminUserId: string,
  adminEmail: string,
  action: string,
  targetId: string,
  newValue: Record<string, unknown>,
) {
  try {
    await admin.from('admin_audit_logs').insert({
      admin_user_id: adminUserId,
      admin_email: adminEmail,
      action,
      target_type: 'user',
      target_id: targetId,
      new_value: newValue,
    })
  } catch (err) {
    console.warn('[admin-manage-user] failed to write audit log', err)
  }
}
