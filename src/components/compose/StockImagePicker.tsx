import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

const CATEGORIES = ['all', 'backgrounds', 'fashion', 'nature', 'science', 'education', 'feelings', 'health', 'people', 'food', 'travel', 'buildings', 'business']
const IMAGE_TYPES = ['photo', 'illustration', 'vector']
const ORIENTATIONS = ['all', 'horizontal', 'vertical']

export function StockImagePicker({ open, onOpenChange, onSelect }: StockImagePickerProps) {
  const [activeTab, setActiveTab] = useState('stock')
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
        per_page: '48',
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Stock Image Picker</DialogTitle>
          <DialogDescription>Select free stock images from Pixabay for your post.</DialogDescription>
        </DialogHeader>

        <Tabs>
          <TabsList className="mt-4">
            <TabsTrigger value="stock" activeValue={activeTab} onClick={() => setActiveTab('stock')}>
              Stock
            </TabsTrigger>
            <TabsTrigger value="pixabay" activeValue={activeTab} onClick={() => setActiveTab('pixabay')}>
              Pixabay
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stock" activeValue={activeTab}>
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">Use Pixabay search below to find free stock images and insert one into your composer.</p>
              <Button variant="outline" onClick={() => setActiveTab('pixabay')}>
                Open Pixabay Search
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="pixabay" activeValue={activeTab}>
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-5">
                <div className="md:col-span-2">
                  <Label>Search</Label>
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. social media marketing" />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={category} onChange={(event) => setCategory(event.target.value)}>
                    {CATEGORIES.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Image type</Label>
                  <Select value={imageType} onChange={(event) => setImageType(event.target.value)}>
                    {IMAGE_TYPES.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Orientation</Label>
                  <Select value={orientation} onChange={(event) => setOrientation(event.target.value)}>
                    {ORIENTATIONS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <Button type="button" onClick={() => void runSearch()} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Search
              </Button>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {results.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    onClick={() => handleSelect(hit)}
                    className="overflow-hidden rounded-xl border text-left transition hover:border-primary"
                  >
                    <img src={hit.previewURL} alt={hit.tags} className="h-32 w-full object-cover" loading="lazy" />
                    <div className="space-y-1 p-2">
                      <p className="line-clamp-2 text-xs text-muted-foreground">{hit.tags}</p>
                      <p className="text-[11px] text-muted-foreground">{hit.user || 'Pixabay'}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </div>
    </Dialog>
  )
}
