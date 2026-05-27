export type MetaAdAccountRow = { id?: string; account_id?: string; name?: string }

export async function fetchMetaAdAccounts(userAccessToken: string): Promise<MetaAdAccountRow[]> {
  const url = `https://graph.facebook.com/v18.0/me/adaccounts?fields=account_id,id,name&access_token=${encodeURIComponent(userAccessToken)}`
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    console.warn('fetchMetaAdAccounts:', data.error?.message || res.status)
    return []
  }
  return Array.isArray(data.data) ? (data.data as MetaAdAccountRow[]) : []
}
