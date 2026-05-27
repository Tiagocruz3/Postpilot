import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { resolveRequestUserId } from '../_shared/api-auth.ts'
import { listPostComments, replyToPostComment } from '../_shared/post-engagement.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const body = await req.json().catch(() => ({}))
  const action: string = body.action || 'comments'

  const userId = await resolveRequestUserId(req, supabase)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const scheduledPostId = body.scheduled_post_id as string | undefined
  if (!scheduledPostId) {
    return new Response(JSON.stringify({ error: 'scheduled_post_id is required.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (action === 'comments') {
    const result = await listPostComments(supabase, scheduledPostId)
    if ('error' in result) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ success: true, comments: result.comments }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (action === 'reply_comment') {
    const message = (body.message as string | undefined) ?? ''
    const commentId = (body.comment_id as string | undefined) || undefined
    const result = await replyToPostComment(supabase, scheduledPostId, message, commentId)
    if ('error' in result) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ success: true, reply_id: result.reply_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ error: 'Unknown action.' }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
