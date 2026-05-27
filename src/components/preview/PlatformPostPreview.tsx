import { format } from 'date-fns'
import { Bookmark, Globe, Heart, MessageCircle, MoreHorizontal, Repeat2, Send, Share2, ThumbsUp, Verified } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PreviewPlatform = 'facebook' | 'instagram' | 'linkedin' | 'x'

export type PlatformPostPreviewProps = {
  platform: PreviewPlatform
  brandName: string
  brandHandle?: string | null
  avatarUrl?: string | null
  content: string
  mediaUrl?: string | null
  mediaType?: 'image' | 'video'
  scheduledAt?: string | Date | null
  status?: 'scheduled' | 'posted'
  className?: string
}

function initialsFor(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return 'P'
  const parts = trimmed.split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || trimmed[0].toUpperCase()
}

function formatTimestamp(value: string | Date | null | undefined, mode: 'short' | 'long' = 'short') {
  if (!value) return 'Just now'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Just now'
  if (mode === 'long') return format(date, 'MMM d, yyyy · h:mm a')
  return format(date, 'MMM d · h:mm a')
}

function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  const initials = initialsFor(name)
  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-slate-500 to-slate-700 text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="font-semibold">{initials}</span>
      )}
    </div>
  )
}

function MediaBlock({
  mediaUrl,
  mediaType,
  aspect = 'video',
  rounded = 'rounded-none',
}: {
  mediaUrl?: string | null
  mediaType?: 'image' | 'video'
  aspect?: 'video' | 'square' | 'free'
  rounded?: string
}) {
  if (!mediaUrl) return null
  const wrapper = cn(
    'w-full overflow-hidden bg-black',
    aspect === 'square' && 'aspect-square',
    aspect === 'video' && 'aspect-[1.91/1]',
    rounded,
  )
  return (
    <div className={wrapper}>
      {mediaType === 'video' ? (
        <video src={mediaUrl} controls className="h-full w-full object-cover" />
      ) : (
        <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
      )}
    </div>
  )
}

function StatusBanner({ status, scheduledAt }: { status?: 'scheduled' | 'posted'; scheduledAt?: string | Date | null }) {
  if (status !== 'scheduled') return null
  return (
    <div className="border-b bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
      Scheduled · publishes {formatTimestamp(scheduledAt, 'long')}
    </div>
  )
}

function FacebookPreview(props: PlatformPostPreviewProps) {
  const { brandName, avatarUrl, content, mediaUrl, mediaType, scheduledAt, status } = props
  return (
    <div className="overflow-hidden rounded-xl border border-[#dadde1] bg-white shadow-sm">
      <StatusBanner status={status} scheduledAt={scheduledAt} />
      <div className="flex items-start gap-3 px-4 pb-2 pt-3">
        <Avatar name={brandName} src={avatarUrl} />
        <div className="flex-1">
          <div className="text-[15px] font-semibold text-[#050505]">{brandName}</div>
          <div className="flex items-center gap-1 text-[12px] text-[#65676b]">
            <span>{formatTimestamp(scheduledAt)}</span>
            <span aria-hidden>·</span>
            <Globe className="h-3 w-3" />
          </div>
        </div>
        <MoreHorizontal className="h-5 w-5 text-[#65676b]" />
      </div>
      <div className="whitespace-pre-wrap px-4 pb-3 text-[15px] text-[#050505]">{content}</div>
      <MediaBlock mediaUrl={mediaUrl} mediaType={mediaType} aspect="video" />
      <div className="flex items-center justify-between border-b border-t border-[#dadde1] px-4 py-1.5 text-[13px] text-[#65676b]">
        <div className="flex items-center gap-1">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1877f2] text-white">
            <ThumbsUp className="h-3 w-3" />
          </span>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f33e58] text-white">
            <Heart className="h-3 w-3" />
          </span>
          <span className="ml-1">0</span>
        </div>
        <div className="flex gap-3">
          <span>0 comments</span>
          <span>0 shares</span>
        </div>
      </div>
      <div className="grid grid-cols-3 px-2 py-1 text-[13px] font-semibold text-[#65676b]">
        <button className="flex items-center justify-center gap-1.5 rounded-md py-1.5 hover:bg-[#f2f2f2]">
          <ThumbsUp className="h-4 w-4" />
          Like
        </button>
        <button className="flex items-center justify-center gap-1.5 rounded-md py-1.5 hover:bg-[#f2f2f2]">
          <MessageCircle className="h-4 w-4" />
          Comment
        </button>
        <button className="flex items-center justify-center gap-1.5 rounded-md py-1.5 hover:bg-[#f2f2f2]">
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>
    </div>
  )
}

function InstagramPreview(props: PlatformPostPreviewProps) {
  const { brandName, brandHandle, avatarUrl, content, mediaUrl, mediaType, scheduledAt, status } = props
  const handle = (brandHandle || brandName).toLowerCase().replace(/\s+/g, '')
  return (
    <div className="overflow-hidden rounded-xl border border-[#dbdbdb] bg-white text-[14px] shadow-sm">
      <StatusBanner status={status} scheduledAt={scheduledAt} />
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
            <div className="rounded-full bg-white p-[2px]">
              <Avatar name={brandName} src={avatarUrl} size={32} />
            </div>
          </div>
          <span className="font-semibold text-[#262626]">{handle}</span>
        </div>
        <MoreHorizontal className="h-5 w-5 text-[#262626]" />
      </div>
      <MediaBlock mediaUrl={mediaUrl} mediaType={mediaType} aspect="square" />
      <div className="flex items-center justify-between px-3 pt-3">
        <div className="flex items-center gap-3 text-[#262626]">
          <Heart className="h-6 w-6" />
          <MessageCircle className="h-6 w-6" />
          <Send className="h-6 w-6" />
        </div>
        <Bookmark className="h-6 w-6 text-[#262626]" />
      </div>
      <div className="px-3 pt-2 text-[#262626]">
        <div className="font-semibold">0 likes</div>
        <div className="mt-1 whitespace-pre-wrap">
          <span className="font-semibold">{handle}</span> {content}
        </div>
        <div className="mt-2 text-[12px] uppercase tracking-wide text-[#8e8e8e]">{formatTimestamp(scheduledAt)}</div>
      </div>
      <div className="px-3 pb-3 pt-2 text-[14px] text-[#8e8e8e]">Add a comment…</div>
    </div>
  )
}

function LinkedInPreview(props: PlatformPostPreviewProps) {
  const { brandName, avatarUrl, content, mediaUrl, mediaType, scheduledAt, status } = props
  return (
    <div className="overflow-hidden rounded-xl border border-[#d0d7de] bg-white shadow-sm">
      <StatusBanner status={status} scheduledAt={scheduledAt} />
      <div className="flex items-start gap-3 px-4 pb-2 pt-3">
        <Avatar name={brandName} src={avatarUrl} size={48} />
        <div className="flex-1">
          <div className="text-[14px] font-semibold text-[#000000e6]">{brandName}</div>
          <div className="text-[12px] text-[#00000099]">Company · Promoted</div>
          <div className="flex items-center gap-1 text-[12px] text-[#00000099]">
            <span>{formatTimestamp(scheduledAt)}</span>
            <span aria-hidden>·</span>
            <Globe className="h-3 w-3" />
          </div>
        </div>
        <MoreHorizontal className="h-5 w-5 text-[#00000099]" />
      </div>
      <div className="whitespace-pre-wrap px-4 pb-3 text-[14px] text-[#000000e6]">{content}</div>
      <MediaBlock mediaUrl={mediaUrl} mediaType={mediaType} aspect="video" />
      <div className="flex items-center justify-between border-t border-[#d0d7de] px-4 py-1.5 text-[12px] text-[#00000099]">
        <div className="flex items-center gap-1">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0a66c2] text-white">
            <ThumbsUp className="h-2.5 w-2.5" />
          </span>
          <span>0</span>
        </div>
        <div>0 comments</div>
      </div>
      <div className="grid grid-cols-4 px-2 py-1 text-[13px] font-semibold text-[#00000099]">
        <button className="flex items-center justify-center gap-1.5 rounded-md py-1.5 hover:bg-[#f3f2ef]">
          <ThumbsUp className="h-4 w-4" />
          Like
        </button>
        <button className="flex items-center justify-center gap-1.5 rounded-md py-1.5 hover:bg-[#f3f2ef]">
          <MessageCircle className="h-4 w-4" />
          Comment
        </button>
        <button className="flex items-center justify-center gap-1.5 rounded-md py-1.5 hover:bg-[#f3f2ef]">
          <Repeat2 className="h-4 w-4" />
          Repost
        </button>
        <button className="flex items-center justify-center gap-1.5 rounded-md py-1.5 hover:bg-[#f3f2ef]">
          <Send className="h-4 w-4" />
          Send
        </button>
      </div>
    </div>
  )
}

function XPreview(props: PlatformPostPreviewProps) {
  const { brandName, brandHandle, avatarUrl, content, mediaUrl, mediaType, scheduledAt, status } = props
  const handle = (brandHandle || brandName).toLowerCase().replace(/\s+/g, '')
  return (
    <div className="overflow-hidden rounded-xl border border-[#2f3336] bg-black text-[15px] text-white shadow-sm">
      <StatusBanner status={status} scheduledAt={scheduledAt} />
      <div className="flex gap-3 px-4 pb-3 pt-4">
        <Avatar name={brandName} src={avatarUrl} />
        <div className="flex-1">
          <div className="flex items-center gap-1 text-[15px]">
            <span className="font-bold">{brandName}</span>
            <Verified className="h-4 w-4 fill-[#1d9bf0] text-black" />
            <span className="text-[#71767b]">@{handle}</span>
            <span className="text-[#71767b]">·</span>
            <span className="text-[#71767b]">{formatTimestamp(scheduledAt)}</span>
          </div>
          <div className="mt-1 whitespace-pre-wrap">{content}</div>
          {mediaUrl ? (
            <div className="mt-3">
              <MediaBlock mediaUrl={mediaUrl} mediaType={mediaType} aspect="video" rounded="rounded-2xl" />
            </div>
          ) : null}
          <div className="mt-3 flex max-w-md items-center justify-between text-[#71767b]">
            <button className="flex items-center gap-1.5 hover:text-[#1d9bf0]">
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs">0</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-[#00ba7c]">
              <Repeat2 className="h-4 w-4" />
              <span className="text-xs">0</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-[#f91880]">
              <Heart className="h-4 w-4" />
              <span className="text-xs">0</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-[#1d9bf0]">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PlatformPostPreview(props: PlatformPostPreviewProps) {
  const { platform, className } = props
  const wrapper = cn('w-full', className)
  return (
    <div className={wrapper}>
      {platform === 'facebook' ? <FacebookPreview {...props} /> : null}
      {platform === 'instagram' ? <InstagramPreview {...props} /> : null}
      {platform === 'linkedin' ? <LinkedInPreview {...props} /> : null}
      {platform === 'x' ? <XPreview {...props} /> : null}
    </div>
  )
}
