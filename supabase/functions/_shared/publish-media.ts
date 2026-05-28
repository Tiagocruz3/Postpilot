export type PublishMediaType = 'image' | 'video'

export type PublishMediaItem = {
  url: string
  type: PublishMediaType
}

export function inferMediaTypeFromUrl(url: string): PublishMediaType {
  const normalized = url.split('?')[0].toLowerCase()
  if (/\.(mp4|mov|webm|m4v|avi|mkv)$/.test(normalized)) {
    return 'video'
  }
  if (normalized.includes('/video') || normalized.includes('gtv-videos-bucket')) {
    return 'video'
  }
  return 'image'
}

export function resolvePublishMedia(
  mediaUrls: string[] | null | undefined,
  mediaTypes: string[] | null | undefined,
): PublishMediaItem[] {
  const urls = Array.isArray(mediaUrls) ? mediaUrls.filter((url) => typeof url === 'string' && url.trim()) : []
  const types = Array.isArray(mediaTypes) ? mediaTypes : []

  return urls.map((url, index) => {
    const explicit = types[index]
    const type: PublishMediaType = explicit === 'video' || explicit === 'image' ? explicit : inferMediaTypeFromUrl(url)
    return { url, type }
  })
}

export function primaryPublishMedia(items: PublishMediaItem[]): PublishMediaItem | null {
  if (!items.length) return null
  return items.find((item) => item.type === 'video') ?? items[0]
}

export function mediaTypesFromTaskPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return []
  const raw = (payload as { media_types?: unknown }).media_types
  return Array.isArray(raw) ? raw.filter((value): value is string => typeof value === 'string') : []
}
