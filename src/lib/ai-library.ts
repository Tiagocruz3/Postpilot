import { supabase } from '@/lib/supabase'

const AI_LIBRARY_BUCKET = 'ai_library'

function extensionForContentType(contentType: string, mediaType: 'image' | 'video'): string {
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  if (contentType.includes('mp4')) return 'mp4'
  if (contentType.includes('webm')) return 'webm'
  return mediaType === 'video' ? 'mp4' : 'png'
}

async function blobFromSourceUrl(sourceUrl: string, mediaType: 'image' | 'video'): Promise<Blob> {
  const response = await fetch(sourceUrl)
  if (!response.ok) {
    throw new Error(`Could not download generated ${mediaType}.`)
  }
  const blob = await response.blob()
  if (blob.size === 0) {
    throw new Error(`Generated ${mediaType} file was empty.`)
  }
  return blob
}

export async function saveGeneratedMediaToVault(input: {
  workspaceId: string
  userId: string
  mediaType: 'image' | 'video'
  sourceUrl: string
  prompt: string
  source?: 'compose' | 'ads' | 'other'
  metadata?: Record<string, unknown>
}): Promise<{ saved: true; id: string; publicUrl: string } | { saved: false; reason: string }> {
  const { data: existing } = await supabase
    .from('workspace_ai_media')
    .select('id, public_url')
    .eq('workspace_id', input.workspaceId)
    .eq('public_url', input.sourceUrl)
    .limit(1)
    .maybeSingle()

  const existingRow = existing as { id?: string; public_url?: string } | null
  if (existingRow?.id) {
    return { saved: true, id: existingRow.id, publicUrl: existingRow.public_url || input.sourceUrl }
  }

  try {
    const blob = await blobFromSourceUrl(input.sourceUrl, input.mediaType)
    const contentType = blob.type || (input.mediaType === 'video' ? 'video/mp4' : 'image/png')
    const ext = extensionForContentType(contentType, input.mediaType)
    const storagePath = `${input.workspaceId}/${input.userId}/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage.from(AI_LIBRARY_BUCKET).upload(storagePath, blob, {
      contentType,
      upsert: false,
    })

    if (uploadError) {
      return { saved: false, reason: uploadError.message }
    }

    const { data: publicData } = supabase.storage.from(AI_LIBRARY_BUCKET).getPublicUrl(storagePath)
    const publicUrl = publicData.publicUrl

    const { data, error: insertError } = await supabase
      .from('workspace_ai_media')
      .insert({
        workspace_id: input.workspaceId,
        created_by: input.userId,
        media_type: input.mediaType,
        storage_bucket: AI_LIBRARY_BUCKET,
        storage_path: storagePath,
        public_url: publicUrl,
        prompt: input.prompt,
        source: input.source ?? 'compose',
        metadata: input.metadata ?? {},
      } as never)
      .select('id')
      .single()

    if (insertError || !data) {
      return { saved: false, reason: insertError?.message || 'Could not record media in vault.' }
    }

    return { saved: true, id: (data as { id: string }).id, publicUrl }
  } catch (err) {
    return { saved: false, reason: err instanceof Error ? err.message : 'Could not save to vault.' }
  }
}
