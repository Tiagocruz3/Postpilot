import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { resolveRequestUserId } from '../_shared/api-auth.ts'
import { listPostComments, replyToPostComment } from '../_shared/post-engagement.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: 'Server configuration error.' }, 500)
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const body = await req.json().catch(() => ({}))
    const action: string = body.action || 'comments'

    const userId = await resolveRequestUserId(req, supabase)
    if (!userId) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const scheduledPostId = body.scheduled_post_id as string | undefined
    if (!scheduledPostId) {
      return jsonResponse({ error: 'scheduled_post_id is required.' }, 400)
    }

    if (action === 'comments') {
      const result = await listPostComments(supabase, scheduledPostId)
      if ('error' in result) {
        return jsonResponse({ error: result.error }, 400)
      }
      return jsonResponse({ success: true, comments: result.comments })
    }

    if (action === 'reply_comment') {
      const message = (body.message as string | undefined) ?? ''
      const commentId = (body.comment_id as string | undefined) || undefined
      const result = await replyToPostComment(supabase, scheduledPostId, message, commentId)
      if ('error' in result) {
        return jsonResponse({ error: result.error }, 400)
      }
      return jsonResponse({ success: true, reply_id: result.reply_id })
    }

    return jsonResponse({ error: 'Unknown action.' }, 400)
  } catch (err) {
    console.error('post-engagement error:', err)
    const message = err instanceof Error ? err.message : 'Unexpected server error.'
    return jsonResponse({ error: message }, 500)
  }
})
