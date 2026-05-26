import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const AI_LIBRARY_BUCKET = 'ai_library'

export type AiMediaType = 'image' | 'video'
export type AiMediaSource = 'compose' | 'ads' | 'other'

export async function assertWorkspaceMember(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) {
    throw new Error('User is not a member of this workspace.')
  }
}

async function bytesFromSourceUrl(sourceUrl: string, mediaType: AiMediaType): Promise<{ bytes: Uint8Array; contentType: string }> {
  if (sourceUrl.startsWith('data:')) {
    const match = sourceUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) {
      throw new Error('Invalid data URL for media.')
    }
    const contentType = match[1]
    const binary = atob(match[2])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return { bytes, contentType }
  }

  const response = await fetch(sourceUrl)
  if (!response.ok) {
    throw new Error(`Failed to download generated ${mediaType}.`)
  }

  const buffer = await response.arrayBuffer()
  const contentType =
    response.headers.get('content-type') ||
    (mediaType === 'video' ? 'video/mp4' : 'image/png')

  return { bytes: new Uint8Array(buffer), contentType }
}

function extensionForContentType(contentType: string, mediaType: AiMediaType): string {
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  if (contentType.includes('mp4')) return 'mp4'
  if (contentType.includes('webm')) return 'webm'
  return mediaType === 'video' ? 'mp4' : 'png'
}

export async function persistAiMedia(
  supabase: SupabaseClient,
  input: {
    workspaceId: string
    userId: string
    mediaType: AiMediaType
    sourceUrl: string
    prompt?: string
    source?: AiMediaSource
    metadata?: Record<string, unknown>
  },
) {
  await assertWorkspaceMember(supabase, input.workspaceId, input.userId)

  const { bytes, contentType } = await bytesFromSourceUrl(input.sourceUrl, input.mediaType)
  const ext = extensionForContentType(contentType, input.mediaType)
  const storagePath = `${input.workspaceId}/${input.userId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage.from(AI_LIBRARY_BUCKET).upload(storagePath, bytes, {
    contentType,
    upsert: false,
  })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data: publicData } = supabase.storage.from(AI_LIBRARY_BUCKET).getPublicUrl(storagePath)
  const publicUrl = publicData.publicUrl

  const { data: row, error: insertError } = await supabase
    .from('workspace_ai_media')
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      media_type: input.mediaType,
      storage_bucket: AI_LIBRARY_BUCKET,
      storage_path: storagePath,
      public_url: publicUrl,
      prompt: input.prompt ?? null,
      source: input.source ?? 'compose',
      metadata: input.metadata ?? {},
    })
    .select('id, public_url, storage_path, media_type, created_at')
    .single()

  if (insertError || !row) {
    throw new Error(insertError?.message || 'Failed to record media in library.')
  }

  return {
    id: row.id as string,
    url: publicUrl,
    storage_path: storagePath,
    media_type: row.media_type as AiMediaType,
    created_at: row.created_at as string,
  }
}
