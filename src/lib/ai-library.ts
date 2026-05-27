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

type SaveVaultInput = {
  workspaceId: string
  userId: string
  mediaType: 'image' | 'video'
  sourceUrl: string
  prompt: string
  source?: 'compose' | 'ads' | 'other'
  metadata?: Record<string, unknown>
}

type SaveVaultResult =
  | { saved: true; id: string; publicUrl: string }
  | { saved: false; reason: string }

async function saveViaEdgeFunction(input: SaveVaultInput): Promise<SaveVaultResult | null> {
  const { data, error } = await supabase.functions.invoke<{
    success?: boolean
    library_id?: string
    url?: string
    error?: string
  }>('save-ai-library', {
    body: {
      workspace_id: input.workspaceId,
      media_type: input.mediaType,
      source_url: input.sourceUrl,
      prompt: input.prompt,
      source: input.source ?? 'compose',
      metadata: input.metadata ?? {},
    },
  })

  if (error) {
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context
    if (context?.json) {
      try {
        const payload = (await context.json()) as { error?: string }
        return { saved: false, reason: payload?.error || error.message }
      } catch {
        // ignore
      }
    }
    return { saved: false, reason: error.message }
  }

  if (data?.error) {
    return { saved: false, reason: data.error }
  }

  if (data?.success && data.library_id) {
    return { saved: true, id: data.library_id, publicUrl: data.url || input.sourceUrl }
  }

  return null
}

async function saveViaClientUpload(input: SaveVaultInput): Promise<SaveVaultResult> {
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
}

export async function saveGeneratedMediaToVault(input: SaveVaultInput): Promise<SaveVaultResult> {
  try {
    const edgeResult = await saveViaEdgeFunction(input)
    if (edgeResult?.saved) {
      return edgeResult
    }
    if (edgeResult && !edgeResult.saved) {
      // Edge failed — try browser upload for data URLs and same-origin assets.
      if (input.sourceUrl.startsWith('data:')) {
        return saveViaClientUpload(input)
      }
      return edgeResult
    }
  } catch {
    // Fall through to client upload.
  }

  try {
    return await saveViaClientUpload(input)
  } catch (err) {
    return { saved: false, reason: err instanceof Error ? err.message : 'Could not save to vault.' }
  }
}

const DEMO_VAULT_KEY_PREFIX = 'postpilot_demo_vault_'

export type DemoVaultItem = {
  id: string
  workspace_id: string
  created_by: string
  media_type: 'image' | 'video'
  storage_bucket: string
  storage_path: string
  public_url: string
  prompt: string | null
  source: 'compose' | 'ads' | 'other'
  metadata: Record<string, unknown>
  created_at: string
}

export function loadDemoVaultItems(workspaceId: string): DemoVaultItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(`${DEMO_VAULT_KEY_PREFIX}${workspaceId}`)
    return raw ? (JSON.parse(raw) as DemoVaultItem[]) : []
  } catch {
    return []
  }
}

export function appendDemoVaultItem(workspaceId: string, userId: string, input: Omit<SaveVaultInput, 'workspaceId' | 'userId'>) {
  if (typeof window === 'undefined') return
  const item: DemoVaultItem = {
    id: `demo-vault-${Date.now()}`,
    workspace_id: workspaceId,
    created_by: userId,
    media_type: input.mediaType,
    storage_bucket: 'demo',
    storage_path: 'demo',
    public_url: input.sourceUrl,
    prompt: input.prompt,
    source: input.source ?? 'compose',
    metadata: input.metadata ?? {},
    created_at: new Date().toISOString(),
  }
  const items = [...loadDemoVaultItems(workspaceId), item]
  window.sessionStorage.setItem(`${DEMO_VAULT_KEY_PREFIX}${workspaceId}`, JSON.stringify(items))
}
