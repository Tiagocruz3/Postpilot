import { useEffect, useMemo, useState } from 'react'
import { ImageIcon, Loader2, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type StockImageMeta = {
  provider: 'pixabay'
  id: string
  pageUrl: string
  previewUrl: string
  tags: string
  photographer?: string
}

type PixabayHit = {
  id: number
  pageURL: string
  previewURL: string
  webformatURL: string
  largeImageURL: string
  tags: string
  user?: string
}

interface StockImagePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (imageUrl: string, meta: StockImageMeta) => void
}

const CATEGORIES = [
  'all',
  'backgrounds',
  'fashion',
  'nature',
  'science',
  'education',
  'feelings',
  'health',
  'people',
  'food',
  'travel',
  'buildings',
  'business',
]
const IMAGE_TYPES = ['photo', 'illustration', 'vector']
const ORIENTATIONS = ['all', 'horizontal', 'vertical']

export function StockImagePicker({ open, onOpenChange, onSelect }: StockImagePickerProps) {
  const [query, setQuery] = useState('business')
  const [category, setCategory] = useState('all')
  const [imageType, setImageType] = useState('photo')
  const [orientation, setOrientation] = useState('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<PixabayHit[]>([])
  const pixabayApiKey = import.meta.env.VITE_PIXABAY_API_KEY

  const hasKey = useMemo(() => Boolean(pixabayApiKey), [pixabayApiKey])

  useEffect(() => {
    if (!open) return
    setError('')
    if (results.length === 0) {
      void runSearch()
    }
  }, [open])

  const runSearch = async () => {
    if (!hasKey) {
      setError('Missing VITE_PIXABAY_API_KEY. Add it in your env to use stock search.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        key: pixabayApiKey || '',
        q: query.trim() || 'business',
        safesearch: 'true',
        per_page: '60',
        image_type: imageType,
      })
      if (category !== 'all') params.set('category', category)
      if (orientation !== 'all') params.set('orientation', orientation)
      const response = await fetch(`https://pixabay.com/api/?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Could not load stock images right now.')
      }
      const data = (await response.json()) as { hits?: PixabayHit[] }
      setResults(data.hits ?? [])
      if (!data.hits?.length) {
        setError('No results found. Try different filters.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stock image search failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (hit: PixabayHit) => {
    onSelect(hit.largeImageURL || hit.webformatURL, {
      provider: 'pixabay',
      id: String(hit.id),
      pageUrl: hit.pageURL,
      previewUrl: hit.previewURL,
      tags: hit.tags,
      photographer: hit.user,
    })
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      overlayClassName="p-2 sm:p-4"
      panelClassName="max-h-[94vh] p-0"
      panelStyle={{ width: 'min(1440px, calc(100vw - 2rem))', maxWidth: 'none' }}
    >
      <DialogHeader className="border-b px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ImageIcon className="h-5 w-5 text-primary" />
              Stock images
            </DialogTitle>
            <DialogDescription className="mt-1.5 max-w-2xl">
              Search free Pixabay photos and click one to attach it to your post.
            </DialogDescription>
          </div>
          {results.length > 0 ? (
            <Badge variant="secondary" className="shrink-0">
              {results.length} result{results.length === 1 ? '' : 's'}
            </Badge>
          ) : null}
        </div>
      </DialogHeader>

      <div className="space-y-4 border-b bg-muted/20 px-6 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="stock-search">Search</Label>
            <div className="flex gap-2">
              <Input
                id="stock-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g. social media marketing, team, product launch"
                className="h-10"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void runSearch()
                  }
                }}
              />
              <Button type="button" className="h-10 shrink-0 px-5" onClick={() => void runSearch()} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Search
              </Button>
            </div>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[420px]">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onChange={(event) => setCategory(event.target.value)}>
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Image type</Label>
              <Select value={imageType} onChange={(event) => setImageType(event.target.value)}>
                {IMAGE_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Orientation</Label>
              <Select value={orientation} onChange={(event) => setOrientation(event.target.value)}>
                {ORIENTATIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <div className="min-h-[420px] flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        {loading ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            Searching Pixabay...
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {results.map((hit) => (
              <button
                key={hit.id}
                type="button"
                onClick={() => handleSelect(hit)}
                className={cn(
                  'group overflow-hidden rounded-2xl border bg-background text-left shadow-sm transition-all duration-200',
                  'hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                )}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  <img
                    src={hit.previewURL}
                    alt={hit.tags}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="text-xs font-medium text-white">Use this image</p>
                  </div>
                </div>
                <div className="space-y-1 p-3">
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{hit.tags}</p>
                  <p className="truncate text-[11px] font-medium text-foreground/70">{hit.user || 'Pixabay'}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
            <p>Search for a topic to browse stock images.</p>
          </div>
        )}
      </div>

      <DialogFooter className="border-t bg-muted/20 px-6 py-4">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
