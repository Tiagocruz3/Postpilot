import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  DEMO_META_AD_ACCOUNTS,
  DEMO_META_INSTAGRAM,
  DEMO_META_PAGES,
  findFacebookIntegration,
  findMetaAdsIntegration,
  parseFacebookPages,
  parseInstagramAccounts,
  parseMetaAdAccounts,
  type MetaAdAccountOption,
  type MetaInstagramOption,
  type MetaPageOption,
} from '@/lib/meta-integration-options'
import type { UserIntegration } from '@/types'

export type MetaConnectionValues = {
  facebookPageId: string
  instagramAccountId: string
  adAccountId: string
}

type MetaConnectionFieldsProps = {
  value: MetaConnectionValues
  onChange: (next: Partial<MetaConnectionValues> & { connectedAt?: string }) => void
  integrations: UserIntegration[]
  isDemoMode?: boolean
  onConnectFacebook: () => void
  onConnectMeta: () => void
}

export function MetaConnectionFields({
  value,
  onChange,
  integrations,
  isDemoMode = false,
  onConnectFacebook,
  onConnectMeta,
}: MetaConnectionFieldsProps) {
  const facebookIntegration = findFacebookIntegration(integrations)
  const metaIntegration = findMetaAdsIntegration(integrations)

  const pages: MetaPageOption[] = isDemoMode ? DEMO_META_PAGES : parseFacebookPages(facebookIntegration)
  const instagramAccounts: MetaInstagramOption[] = isDemoMode
    ? DEMO_META_INSTAGRAM
    : parseInstagramAccounts(facebookIntegration)
  const adAccounts: MetaAdAccountOption[] = isDemoMode ? DEMO_META_AD_ACCOUNTS : parseMetaAdAccounts(metaIntegration)

  const facebookConnected = pages.length > 0
  const metaAdsConnected = adAccounts.length > 0

  const handlePageChange = (pageId: string) => {
    const linkedInstagram = instagramAccounts.find((account) => account.pageId === pageId)
    onChange({
      facebookPageId: pageId,
      instagramAccountId: linkedInstagram?.id ?? value.instagramAccountId,
      connectedAt: new Date().toISOString(),
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Pick your real Facebook Page, Instagram account, and Meta ad account from the connected data below.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <MetaSelectField
          label="Facebook Page"
          placeholder="Select a Facebook Page"
          emptyHint="Connect Facebook to load your Pages."
          options={pages.map((page) => ({ value: page.id, label: page.name }))}
          value={value.facebookPageId}
          onChange={handlePageChange}
          connected={facebookConnected}
          onConnect={onConnectFacebook}
          connectLabel="Connect Facebook"
        />

        <MetaSelectField
          label="Instagram account"
          placeholder="Select an Instagram account"
          emptyHint="Link Instagram to your Facebook Page, then reconnect Facebook if needed."
          options={instagramAccounts.map((account) => ({
            value: account.id,
            label: `@${account.username} · ${account.name}`,
          }))}
          value={value.instagramAccountId}
          onChange={(accountId) =>
            onChange({ instagramAccountId: accountId, connectedAt: new Date().toISOString() })
          }
          connected={instagramAccounts.length > 0}
          onConnect={onConnectFacebook}
          connectLabel="Connect Facebook"
        />

        <MetaSelectField
          label="Meta ad account"
          placeholder="Select an ad account"
          emptyHint="Connect Meta Ads to load your ad accounts."
          options={adAccounts.map((account) => ({
            value: account.id,
            label: `${account.name} (${account.id})`,
          }))}
          value={value.adAccountId}
          onChange={(accountId) => onChange({ adAccountId: accountId, connectedAt: new Date().toISOString() })}
          connected={metaAdsConnected}
          onConnect={onConnectMeta}
          connectLabel="Connect Meta Ads"
        />
      </div>
    </div>
  )
}

function MetaSelectField({
  label,
  placeholder,
  emptyHint,
  options,
  value,
  onChange,
  connected,
  onConnect,
  connectLabel,
}: {
  label: string
  placeholder: string
  emptyHint: string
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
  connected: boolean
  onConnect: () => void
  connectLabel: string
}) {
  return (
    <div className="space-y-2 rounded-2xl border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
        {connected ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
            <Check className="h-3 w-3" />
            Connected
          </span>
        ) : null}
      </div>

      {options.length > 0 ? (
        <Select id={`meta-${label}`} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{emptyHint}</p>
          <Button type="button" size="sm" variant="outline" onClick={onConnect}>
            {connectLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
