import {
  defaultFacebookPageId,
  defaultInstagramAccountId,
  defaultMetaAdAccountId,
  findFacebookIntegration,
  findMetaAdsIntegration,
  parseFacebookPages,
  parseInstagramAccounts,
} from '@/lib/meta-integration-options'
import type { UserIntegration } from '@/types'
import type { MetaConnectionValues } from '@/components/ads/MetaConnectionFields'

export function syncMetaConnectionFromIntegrations(
  current: MetaConnectionValues,
  integrations: UserIntegration[],
): MetaConnectionValues | null {
  const facebookIntegration = findFacebookIntegration(integrations)
  const metaIntegration = findMetaAdsIntegration(integrations)
  const pages = parseFacebookPages(facebookIntegration)
  const pageIds = new Set(pages.map((page) => page.id))

  const nextPageId = defaultFacebookPageId(facebookIntegration)
  const instagramAccounts = parseInstagramAccounts(facebookIntegration)
  const nextAdAccountId = defaultMetaAdAccountId(metaIntegration, facebookIntegration)

  const metaConnection = { ...current }
  let changed = false

  if (nextPageId && (!metaConnection.facebookPageId || !pageIds.has(metaConnection.facebookPageId))) {
    metaConnection.facebookPageId = nextPageId
    changed = true
  }

  const pageId = metaConnection.facebookPageId
  const instagramForPage = pageId
    ? instagramAccounts.filter((account) => account.pageId === pageId)
    : instagramAccounts
  const nextInstagramId =
    instagramForPage.find((account) => account.id === metaConnection.instagramAccountId)?.id ??
    defaultInstagramAccountId(facebookIntegration)

  if (nextInstagramId && metaConnection.instagramAccountId !== nextInstagramId) {
    metaConnection.instagramAccountId = nextInstagramId
    changed = true
  }

  if (nextAdAccountId && !metaConnection.adAccountId) {
    metaConnection.adAccountId = nextAdAccountId
    changed = true
  }

  if (!changed) {
    return null
  }

  metaConnection.connectedAt = metaConnection.connectedAt || new Date().toISOString()
  return metaConnection
}
