import { useId, useMemo, useState } from 'react'
import {
  Bookmark,
  Globe,
  Heart,
  Home,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Search,
  Send,
  Share2,
  ShoppingBag,
  Sparkles,
  ThumbsUp,
  Users,
  Video,
  Volume2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type AdPlacement =
  | 'facebook-feed'
  | 'instagram-feed'
  | 'story'
  | 'reel'
  | 'marketplace'
  | 'right-column'

export type AdDevice = 'mobile' | 'desktop'

export type FacebookAdPreviewData = {
  pageName: string
  pageAvatarUrl?: string | null
  primaryText: string
  headline: string
  description?: string
  cta: string
  mediaUrl?: string | null
  mediaType?: 'image' | 'video'
  destinationDomain?: string
}

type FacebookAdPreviewProps = {
  data: FacebookAdPreviewData
  placement?: AdPlacement
  device?: AdDevice
  className?: string
  /**
   * When true, the media slot renders an animated shimmer placeholder instead
   * of the static empty-state icon. Used while AI image / video generation is
   * still in flight so the ad card feels "alive" until the asset arrives.
   */
  mediaLoading?: boolean
}

const DEFAULT_AVATAR_BG = 'linear-gradient(135deg, #1877F2, #00C6FF)'

/**
 * AI copy often arrives with ragged spacing (trailing spaces, runs of 3+
 * newlines). With `whitespace-pre-line` those blank lines render as big gaps,
 * so collapse any run of blank lines down to a single blank line between
 * paragraphs and trim the ends.
 */
export function normalizeAdCopy(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function PageAvatar({ url, name, size = 36 }: { url?: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  const initial = (name?.trim()?.[0] ?? 'B').toUpperCase()
  return (
    <div
      className="flex items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ width: size, height: size, background: DEFAULT_AVATAR_BG }}
    >
      {initial}
    </div>
  )
}

function MediaArea({
  data,
  aspect,
  loading = false,
}: {
  data: FacebookAdPreviewData
  aspect: 'square' | 'portrait' | 'landscape'
  loading?: boolean
}) {
  const aspectClass =
    aspect === 'square' ? 'aspect-square' : aspect === 'portrait' ? 'aspect-[9/16]' : 'aspect-[16/9]'

  if (loading) {
    const Icon = data.mediaType === 'video' ? Video : ImageIcon
    const label = data.mediaType === 'video' ? 'Rendering your video' : 'Designing your image'
    const sublabel =
      data.mediaType === 'video' ? 'This can take up to a minute' : 'Usually ready in 10-20 seconds'
    return (
      <div
        className={cn(
          'relative w-full overflow-hidden bg-gradient-to-br from-primary/10 via-blue-500/5 to-blue-600/10',
          aspectClass,
        )}
        aria-live="polite"
        aria-busy="true"
      >
        <div className="alive-shimmer absolute inset-0" />
        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-background/85 shadow-sm backdrop-blur">
            <Icon className="h-5 w-5 text-primary" />
            <Loader2 className="absolute -bottom-1 -right-1 h-4 w-4 animate-spin rounded-full bg-background p-0.5 text-primary shadow-sm" />
          </div>
          <div className="space-y-0.5">
            <p className="flex items-center justify-center gap-1 text-xs font-semibold text-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              {label}
            </p>
            <p className="text-[10px] text-muted-foreground">{sublabel}</p>
          </div>
          <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
            <div className="alive-shimmer h-full w-2/3 rounded-full bg-primary/60" />
          </div>
        </div>
      </div>
    )
  }

  if (!data.mediaUrl) {
    return (
      <div
        className={cn(
          'flex w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 dark:from-slate-800 dark:to-slate-900 dark:text-slate-600',
          aspectClass,
        )}
      >
        {data.mediaType === 'video' ? (
          <Video className="h-10 w-10" />
        ) : (
          <ImageIcon className="h-10 w-10" />
        )}
      </div>
    )
  }
  return data.mediaType === 'video' ? (
    <video
      src={data.mediaUrl}
      muted
      playsInline
      loop
      autoPlay
      className={cn('w-full bg-black object-cover', aspectClass)}
    />
  ) : (
    <img src={data.mediaUrl} alt="" className={cn('w-full object-cover', aspectClass)} />
  )
}

function CtaButton({ label, variant = 'feed' }: { label: string; variant?: 'feed' | 'subtle' }) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
        variant === 'feed'
          ? 'bg-[#E4E6EB] text-slate-900 hover:bg-[#D8DADF] dark:bg-slate-700 dark:text-slate-100'
          : 'bg-white/95 text-slate-900',
      )}
    >
      {label}
    </button>
  )
}

function ActionRow({ compact = false }: { compact?: boolean }) {
  const base = compact ? 'gap-1' : 'gap-2'
  return (
    <div className="flex items-center justify-around border-t border-slate-200 px-2 py-1 text-slate-600 dark:border-slate-800 dark:text-slate-300">
      <button type="button" className={cn('flex items-center text-xs font-medium', base)}>
        <ThumbsUp className="h-4 w-4" />
        Like
      </button>
      <button type="button" className={cn('flex items-center text-xs font-medium', base)}>
        <MessageCircle className="h-4 w-4" />
        Comment
      </button>
      <button type="button" className={cn('flex items-center text-xs font-medium', base)}>
        <Share2 className="h-4 w-4" />
        Share
      </button>
    </div>
  )
}

function FacebookFeedAd({ data, device, mediaLoading }: { data: FacebookAdPreviewData; device: AdDevice; mediaLoading?: boolean }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900',
        device === 'mobile' ? 'w-full max-w-sm' : 'w-full max-w-xl',
      )}
    >
      <div className="flex items-start justify-between gap-2 px-3 pt-3">
        <div className="flex items-center gap-2">
          <PageAvatar url={data.pageAvatarUrl} name={data.pageName} />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {data.pageName || 'Your Page'}
            </p>
            <p className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span>Sponsored</span>
              <span aria-hidden>·</span>
              <Globe className="h-3 w-3" />
            </p>
          </div>
        </div>
        <button type="button" className="text-slate-500 hover:text-slate-700 dark:text-slate-400">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      <p className="whitespace-pre-line px-3 py-2 text-sm text-slate-900 dark:text-slate-100">
        {data.primaryText || 'Your ad copy will appear here.'}
      </p>

      <MediaArea data={data} aspect="square" loading={mediaLoading} />

      <div className="flex items-center justify-between gap-3 bg-slate-50 px-3 py-2 dark:bg-slate-800">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {data.destinationDomain || 'your-website.com'}
          </p>
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {data.headline || 'Your headline'}
          </p>
          {data.description ? (
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{data.description}</p>
          ) : null}
        </div>
        <CtaButton label={data.cta || 'Learn More'} />
      </div>

      <ActionRow />
    </div>
  )
}

function InstagramFeedAd({ data, device, mediaLoading }: { data: FacebookAdPreviewData; device: AdDevice; mediaLoading?: boolean }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900',
        device === 'mobile' ? 'w-full max-w-sm' : 'w-full max-w-md',
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <PageAvatar url={data.pageAvatarUrl} name={data.pageName} size={28} />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {(data.pageName || 'yourbrand').toLowerCase().replace(/\s+/g, '')}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Sponsored</p>
          </div>
        </div>
        <MoreHorizontal className="h-4 w-4 text-slate-500" />
      </div>

      <MediaArea data={data} aspect="square" loading={mediaLoading} />

      <div className="flex items-center justify-between px-3 py-2 text-slate-700 dark:text-slate-200">
        <div className="flex items-center gap-3">
          <Heart className="h-5 w-5" />
          <MessageCircle className="h-5 w-5" />
          <Send className="h-5 w-5" />
        </div>
        <Bookmark className="h-5 w-5" />
      </div>

      <div className="space-y-1 px-3 pb-3 text-sm text-slate-900 dark:text-slate-100">
        <p>
          <span className="font-semibold">
            {(data.pageName || 'yourbrand').toLowerCase().replace(/\s+/g, '')}
          </span>{' '}
          {data.primaryText || 'Your ad copy will appear here.'}
        </p>
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {data.headline || ''}
        </p>
        <button
          type="button"
          className="mt-2 w-full rounded-md bg-[#0095F6] py-1.5 text-xs font-semibold text-white"
        >
          {data.cta || 'Learn More'}
        </button>
      </div>
    </div>
  )
}

function StoryAd({ data, mediaLoading }: { data: FacebookAdPreviewData; device: AdDevice; mediaLoading?: boolean }) {
  return (
    <div className="relative w-full max-w-[260px] overflow-hidden rounded-[28px] border border-slate-800 bg-black shadow-xl">
      <div className="aspect-[9/16] relative">
        <MediaArea data={data} aspect="portrait" loading={mediaLoading} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black to-transparent" />

        <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-3 pt-3">
          <div className="flex flex-1 gap-1">
            <div className="h-0.5 flex-1 rounded-full bg-white/60" />
            <div className="h-0.5 flex-1 rounded-full bg-white/30" />
          </div>
        </div>

        <div className="absolute inset-x-0 top-5 z-10 flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <PageAvatar url={data.pageAvatarUrl} name={data.pageName} size={26} />
            <div className="leading-tight text-white">
              <p className="text-xs font-semibold">{data.pageName || 'Your Page'}</p>
              <p className="text-[10px] opacity-80">Sponsored</p>
            </div>
          </div>
          <X className="h-4 w-4 text-white" />
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 space-y-2 px-3 pb-4">
          <p className="line-clamp-2 text-sm font-semibold text-white">
            {data.headline || 'Your headline'}
          </p>
          <p className="line-clamp-2 text-xs text-white/80">{data.primaryText || 'Your ad copy'}</p>
          <button
            type="button"
            className="w-full rounded-full bg-white py-2 text-xs font-semibold text-slate-900"
          >
            {data.cta || 'Learn More'} →
          </button>
        </div>
      </div>
    </div>
  )
}

function ReelAd({ data, mediaLoading }: { data: FacebookAdPreviewData; device: AdDevice; mediaLoading?: boolean }) {
  return (
    <div className="relative w-full max-w-[260px] overflow-hidden rounded-[28px] border border-slate-800 bg-black shadow-xl">
      <div className="relative aspect-[9/16]">
        <MediaArea data={data} aspect="portrait" loading={mediaLoading} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black via-black/60 to-transparent" />

        <div className="absolute right-3 top-1/3 z-10 flex flex-col items-center gap-4 text-white">
          <Heart className="h-6 w-6" />
          <MessageCircle className="h-6 w-6" />
          <Send className="h-6 w-6" />
          <Bookmark className="h-6 w-6" />
          <Volume2 className="h-6 w-6" />
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 space-y-2 px-3 pb-5 pr-12">
          <div className="flex items-center gap-2">
            <PageAvatar url={data.pageAvatarUrl} name={data.pageName} size={26} />
            <p className="text-xs font-semibold text-white">{data.pageName || 'Your Page'}</p>
            <span className="rounded-full border border-white/40 px-2 py-0.5 text-[10px] font-medium text-white">
              Sponsored
            </span>
          </div>
          <p className="line-clamp-3 text-xs text-white">{data.primaryText || 'Your ad copy'}</p>
          <button
            type="button"
            className="w-full rounded-md bg-white py-2 text-xs font-semibold text-slate-900"
          >
            {data.cta || 'Learn More'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MarketplaceAd({ data, device, mediaLoading }: { data: FacebookAdPreviewData; device: AdDevice; mediaLoading?: boolean }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900',
        device === 'mobile' ? 'w-full max-w-[220px]' : 'w-full max-w-xs',
      )}
    >
      <MediaArea data={data} aspect="square" loading={mediaLoading} />
      <div className="space-y-1 p-3">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Sponsored</p>
        <p className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {data.headline || 'Your headline'}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {data.destinationDomain || 'your-website.com'}
        </p>
        <button
          type="button"
          className="mt-2 w-full rounded-md bg-[#E4E6EB] py-1.5 text-xs font-semibold text-slate-900"
        >
          {data.cta || 'Learn More'}
        </button>
      </div>
    </div>
  )
}

function RightColumnAd({ data, mediaLoading }: { data: FacebookAdPreviewData; mediaLoading?: boolean }) {
  return (
    <div className="flex w-full max-w-xs gap-3 rounded-lg border bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded">
        <MediaArea data={data} aspect="square" loading={mediaLoading} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="space-y-0.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Sponsored
          </p>
          <p className="line-clamp-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
            {data.headline || 'Your headline'}
          </p>
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {data.destinationDomain || 'your-website.com'}
          </p>
        </div>
        <CtaButton label={data.cta || 'Learn More'} />
      </div>
    </div>
  )
}

function PlacementChrome({
  placement,
  device,
  children,
}: {
  placement: AdPlacement
  device: AdDevice
  children: React.ReactNode
}) {
  const labels: Record<AdPlacement, string> = {
    'facebook-feed': 'Facebook Feed',
    'instagram-feed': 'Instagram Feed',
    story: 'Story',
    reel: 'Reel',
    marketplace: 'Marketplace',
    'right-column': 'Right column',
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>{labels[placement]}</span>
        <span aria-hidden>·</span>
        <span>{device === 'mobile' ? 'Mobile' : 'Desktop'}</span>
      </div>
      <div className="flex justify-center">{children}</div>
    </div>
  )
}

export function FacebookAdPreview({
  data,
  placement = 'facebook-feed',
  device = 'mobile',
  className,
  mediaLoading = false,
}: FacebookAdPreviewProps) {
  const id = useId()
  const normalizedData = useMemo(
    () => ({ ...data, primaryText: normalizeAdCopy(data.primaryText) }),
    [data],
  )
  let body: React.ReactNode
  switch (placement) {
    case 'instagram-feed':
      body = <InstagramFeedAd data={normalizedData} device={device} mediaLoading={mediaLoading} />
      break
    case 'story':
      body = <StoryAd data={normalizedData} device={device} mediaLoading={mediaLoading} />
      break
    case 'reel':
      body = <ReelAd data={normalizedData} device={device} mediaLoading={mediaLoading} />
      break
    case 'marketplace':
      body = <MarketplaceAd data={normalizedData} device={device} mediaLoading={mediaLoading} />
      break
    case 'right-column':
      body = <RightColumnAd data={normalizedData} mediaLoading={mediaLoading} />
      break
    case 'facebook-feed':
    default:
      body = <FacebookFeedAd data={normalizedData} device={device} mediaLoading={mediaLoading} />
      break
  }

  return (
    <div key={id} className={cn('flex w-full justify-center', className)}>
      <PlacementChrome placement={placement} device={device}>
        {body}
      </PlacementChrome>
    </div>
  )
}

export const AD_PLACEMENTS: Array<{ id: AdPlacement; label: string; icon: React.ReactNode }> = [
  { id: 'facebook-feed', label: 'Facebook Feed', icon: <Home className="h-3.5 w-3.5" /> },
  { id: 'instagram-feed', label: 'Instagram', icon: <ImageIcon className="h-3.5 w-3.5" /> },
  { id: 'story', label: 'Story', icon: <Users className="h-3.5 w-3.5" /> },
  { id: 'reel', label: 'Reel', icon: <Video className="h-3.5 w-3.5" /> },
  { id: 'marketplace', label: 'Marketplace', icon: <ShoppingBag className="h-3.5 w-3.5" /> },
  { id: 'right-column', label: 'Right column', icon: <Search className="h-3.5 w-3.5" /> },
]
