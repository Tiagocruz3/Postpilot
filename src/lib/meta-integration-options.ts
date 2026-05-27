import type { UserIntegration } from '@/types'

export type MetaPageOption = { id: string; name: string }
export type MetaInstagramOption = { id: string; username: string; name: string; pageId: string }
export type MetaAdAccountOption = { id: string; name: string }

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export function normalizeMetaAdAccountId(raw: string): string {
  return raw.replace(/^act_/, '')
}

export function findFacebookIntegration(integrations: UserIntegration[]) {
  return integrations.find((row) => row.provider === 'facebook' || row.provider === 'meta')
}

export function findMetaAdsIntegration(integrations: UserIntegration[]) {
  return integrations.find((row) => row.provider === 'meta')
}

export function parseFacebookPages(integration?: UserIntegration | null): MetaPageOption[] {
  const raw = integration?.metadata?.pages
  if (!Array.isArray(raw)) {
    const pageId = integration?.metadata?.page_id
    const pageName = integration?.metadata?.page_name
    if (typeof pageId === 'string') {
      return [{ id: pageId, name: typeof pageName === 'string' ? pageName : pageId }]
    }
    return []
  }

  return raw
    .map((entry) => {
      const record = asRecord(entry)
      const id = typeof record?.id === 'string' ? record.id : null
      const name = typeof record?.name === 'string' ? record.name : id
      return id ? { id, name: name || id } : null
    })
    .filter((entry): entry is MetaPageOption => Boolean(entry))
}

export function parseInstagramAccounts(integration?: UserIntegration | null): MetaInstagramOption[] {
  const raw = integration?.metadata?.instagram_accounts
  if (!Array.isArray(raw)) return []

  return raw
    .map((entry) => {
      const record = asRecord(entry)
      const id = typeof record?.id === 'string' ? record.id : null
      const username = typeof record?.username === 'string' ? record.username : id
      const name = typeof record?.name === 'string' ? record.name : username
      const pageId = typeof record?.page_id === 'string' ? record.page_id : ''
      return id ? { id, username: username || id, name: name || username || id, pageId } : null
    })
    .filter((entry): entry is MetaInstagramOption => Boolean(entry))
}

function parseMetaAdAccountsFromRaw(raw: unknown): MetaAdAccountOption[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((entry) => {
      const record = asRecord(entry)
      const rawId = typeof record?.account_id === 'string' ? record.account_id : typeof record?.id === 'string' ? record.id : null
      if (!rawId) return null
      const id = normalizeMetaAdAccountId(rawId)
      const name = typeof record?.name === 'string' ? record.name : `Ad account ${id}`
      return { id, name }
    })
    .filter((entry): entry is MetaAdAccountOption => Boolean(entry))
}

export function parseMetaAdAccounts(
  metaIntegration?: UserIntegration | null,
  facebookIntegration?: UserIntegration | null,
): MetaAdAccountOption[] {
  const fromMeta = parseMetaAdAccountsFromRaw(metaIntegration?.metadata?.ad_accounts)
  if (fromMeta.length > 0) {
    return fromMeta
  }
  return parseMetaAdAccountsFromRaw(facebookIntegration?.metadata?.ad_accounts)
}

export function defaultFacebookPageId(integration?: UserIntegration | null): string {
  const selected = integration?.metadata?.selected_page_id
  if (typeof selected === 'string' && selected) return selected
  const legacy = integration?.metadata?.page_id
  if (typeof legacy === 'string' && legacy) return legacy
  return parseFacebookPages(integration)[0]?.id ?? ''
}

export function defaultInstagramAccountId(integration?: UserIntegration | null): string {
  const selected = integration?.metadata?.selected_instagram_account_id
  if (typeof selected === 'string' && selected) return selected
  return parseInstagramAccounts(integration)[0]?.id ?? ''
}

export function defaultMetaAdAccountId(
  metaIntegration?: UserIntegration | null,
  facebookIntegration?: UserIntegration | null,
): string {
  return parseMetaAdAccounts(metaIntegration, facebookIntegration)[0]?.id ?? ''
}

export const DEMO_META_PAGES: MetaPageOption[] = [{ id: 'demo-page-1', name: 'Demo Business Page' }]
export const DEMO_META_INSTAGRAM: MetaInstagramOption[] = [
  { id: 'demo-ig-1', username: 'demobrand', name: 'Demo Brand', pageId: 'demo-page-1' },
]
export const DEMO_META_AD_ACCOUNTS: MetaAdAccountOption[] = [{ id: '1234567890', name: 'Demo Ad Account' }]
