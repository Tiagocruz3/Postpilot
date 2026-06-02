import { supabase } from '@/lib/supabase'

export type AdCreativeStatus =
  | 'ai_draft'
  | 'draft'
  | 'published'
  | 'paused'
  | 'completed'
  | 'archived'

export type AdCreativeSource = 'ai' | 'manual'

export type AdCreativeAudience = {
  location?: string | null
  age_min?: number | null
  age_max?: number | null
  genders?: string[]
  interests?: string[]
  behaviours?: string[]
  audience_size?: 'narrow' | 'balanced' | 'broad'
}

export type AdCreativeBudget = {
  type?: 'daily' | 'lifetime'
  daily?: number | null
  lifetime?: number | null
  duration_days?: number | null
}

export type AdCreativeEstimatedReach = {
  min?: number | null
  max?: number | null
  audience_pool?: number | null
  currency?: string | null
}

export type AdCreativeRecommendation = {
  preferred_variant?: string | null
  reason?: string | null
}

export type AdCreative = {
  id: string
  workspace_id: string
  user_id: string
  facebook_page_id: string | null
  generation_id: string | null
  variant_label: string
  campaign_name: string | null
  is_selected_variant: boolean
  status: AdCreativeStatus
  source: AdCreativeSource
  angle: string | null
  primary_text: string
  headline: string
  description: string | null
  cta: string
  media_url: string | null
  media_type: 'image' | 'video' | null
  image_prompt: string | null
  creative_direction: string | null
  targeting_angle: string | null
  destination_url: string | null
  destination_type: string | null
  goal: string | null
  placements: string[]
  ad_format: string | null
  audience: AdCreativeAudience
  budget: AdCreativeBudget
  schedule_start: string | null
  schedule_end: string | null
  estimated_reach: AdCreativeEstimatedReach
  ai_recommendation: AdCreativeRecommendation
  meta_ad_id: string | null
  meta_campaign_id: string | null
  meta_adset_id: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export type AdCreativeInsert = Partial<Omit<AdCreative, 'id' | 'created_at' | 'updated_at'>> & {
  workspace_id: string
  user_id: string
}

export type AdCreativeUpdate = Partial<Omit<AdCreative, 'id' | 'workspace_id' | 'user_id' | 'created_at' | 'updated_at'>>

const TABLE = 'ad_creatives'

/**
 * `ad_creatives` is not yet listed in the generated `Database` schema types,
 * so we use an untyped client view to insert/update raw payloads here.
 * All shapes are validated by the SQL constraints and the `normalize()` helper.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase

function normalize(row: Record<string, unknown>): AdCreative {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    user_id: String(row.user_id),
    facebook_page_id: (row.facebook_page_id as string | null) ?? null,
    generation_id: (row.generation_id as string | null) ?? null,
    variant_label: String(row.variant_label || 'Variant A'),
    campaign_name: (row.campaign_name as string | null) ?? null,
    is_selected_variant: Boolean(row.is_selected_variant),
    status: (row.status as AdCreativeStatus) || 'ai_draft',
    source: (row.source as AdCreativeSource) || 'ai',
    angle: (row.angle as string | null) ?? null,
    primary_text: String(row.primary_text ?? ''),
    headline: String(row.headline ?? ''),
    description: (row.description as string | null) ?? null,
    cta: String(row.cta ?? 'Learn More'),
    media_url: (row.media_url as string | null) ?? null,
    media_type: (row.media_type as 'image' | 'video' | null) ?? null,
    image_prompt: (row.image_prompt as string | null) ?? null,
    creative_direction: (row.creative_direction as string | null) ?? null,
    targeting_angle: (row.targeting_angle as string | null) ?? null,
    destination_url: (row.destination_url as string | null) ?? null,
    destination_type: (row.destination_type as string | null) ?? null,
    goal: (row.goal as string | null) ?? null,
    placements: Array.isArray(row.placements) ? (row.placements as string[]) : [],
    ad_format: (row.ad_format as string | null) ?? null,
    audience: (row.audience as AdCreativeAudience) || {},
    budget: (row.budget as AdCreativeBudget) || {},
    schedule_start: (row.schedule_start as string | null) ?? null,
    schedule_end: (row.schedule_end as string | null) ?? null,
    estimated_reach: (row.estimated_reach as AdCreativeEstimatedReach) || {},
    ai_recommendation: (row.ai_recommendation as AdCreativeRecommendation) || {},
    meta_ad_id: (row.meta_ad_id as string | null) ?? null,
    meta_campaign_id: (row.meta_campaign_id as string | null) ?? null,
    meta_adset_id: (row.meta_adset_id as string | null) ?? null,
    published_at: (row.published_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export async function insertAdCreatives(rows: AdCreativeInsert[]): Promise<AdCreative[]> {
  if (rows.length === 0) return []
  const { data, error } = await db.from(TABLE).insert(rows).select('*')
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(normalize)
}

/**
 * Clone an existing creative into a fresh editable DRAFT. The Meta link ids and
 * publish state are deliberately cleared so publishing the copy creates a
 * brand-new ad instead of mutating (and overwriting) the original. This is what
 * powers "Reuse" in the Ad Library. Returns the new row.
 */
export async function duplicateAdCreative(
  source: AdCreative,
  overrides: Partial<AdCreativeInsert> = {},
): Promise<AdCreative> {
  const insert: AdCreativeInsert = {
    workspace_id: source.workspace_id,
    user_id: source.user_id,
    facebook_page_id: source.facebook_page_id,
    generation_id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : null,
    variant_label: source.variant_label || 'Variant A',
    campaign_name: source.campaign_name ? `${source.campaign_name} (copy)` : null,
    is_selected_variant: true,
    status: 'draft',
    source: source.source,
    angle: source.angle,
    primary_text: source.primary_text,
    headline: source.headline,
    description: source.description,
    cta: source.cta,
    media_url: source.media_url,
    media_type: source.media_type,
    image_prompt: source.image_prompt,
    creative_direction: source.creative_direction,
    targeting_angle: source.targeting_angle,
    destination_url: source.destination_url,
    destination_type: source.destination_type,
    goal: source.goal,
    placements: source.placements,
    ad_format: source.ad_format,
    audience: source.audience,
    budget: source.budget,
    schedule_start: source.schedule_start,
    schedule_end: source.schedule_end,
    estimated_reach: source.estimated_reach,
    ai_recommendation: source.ai_recommendation,
    // Cleared so the copy publishes as a brand-new Meta ad rather than reusing
    // (and overwriting) the original campaign / ad set / ad.
    meta_ad_id: null,
    meta_campaign_id: null,
    meta_adset_id: null,
    published_at: null,
    ...overrides,
  }
  const [row] = await insertAdCreatives([insert])
  return row
}

export async function updateAdCreative(id: string, patch: AdCreativeUpdate): Promise<AdCreative | null> {
  const { data, error } = await db.from(TABLE).update(patch).eq('id', id).select('*').maybeSingle()
  if (error) throw error
  return data ? normalize(data as Record<string, unknown>) : null
}

export async function deleteAdCreative(id: string): Promise<void> {
  const { error } = await db.from(TABLE).delete().eq('id', id)
  if (error) throw error
}

export type ListAdCreativesParams = {
  workspaceId: string
  /**
   * When provided, scope results strictly to the given Facebook Page. Rows are
   * assigned a page id on creation (and legacy rows are backfilled to the
   * active Page in the UI), so each Page only ever shows its own ads.
   */
  facebookPageId?: string | null
  status?: AdCreativeStatus | 'all'
  search?: string
  limit?: number
}

export async function listAdCreatives({
  workspaceId,
  facebookPageId,
  status,
  search,
  limit = 100,
}: ListAdCreativesParams): Promise<AdCreative[]> {
  let query = db
    .from(TABLE)
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (facebookPageId) {
    query = query.eq('facebook_page_id', facebookPageId)
  }
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  if (search && search.trim()) {
    const term = `%${search.trim().replace(/[%_]/g, (m) => `\\${m}`)}%`
    query = query.or(
      `headline.ilike.${term},primary_text.ilike.${term},campaign_name.ilike.${term}`,
    )
  }
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(normalize)
}

/**
 * Mark one variant in a generation group as the selected one, demoting siblings.
 */
export async function setSelectedVariant(generationId: string, selectedId: string): Promise<void> {
  await db
    .from(TABLE)
    .update({ is_selected_variant: false })
    .eq('generation_id', generationId)
    .neq('id', selectedId)
  await db.from(TABLE).update({ is_selected_variant: true }).eq('id', selectedId)
}

export const AD_CREATIVE_STATUS_LABELS: Record<AdCreativeStatus, string> = {
  ai_draft: 'AI draft',
  draft: 'Draft',
  published: 'Published',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
}
