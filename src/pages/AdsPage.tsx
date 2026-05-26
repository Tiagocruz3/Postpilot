import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { BookOpen, Link, Sparkles } from 'lucide-react'
import { supabase, redirectToEdgeFunction } from '@/lib/supabase'
import { isDemoMode } from '@/lib/demo'
import { AdVariant } from '@/types'
import type { Json } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

interface OutletContext {
  currentWorkspaceId: string | null
}

type AdsTab = 'library' | 'studio'

interface CampaignSummary {
  id: string
  name: string
  objective: string
  status: string
}

export function AdsPage() {
  const { currentWorkspaceId } = useOutletContext<OutletContext>()
  const [activeTab, setActiveTab] = useState<AdsTab>('library')
  const [onboarding, setOnboarding] = useState<Record<string, string>>({})
  const [brief, setBrief] = useState('')
  const [variants, setVariants] = useState<AdVariant[]>([])
  const [generating, setGenerating] = useState(false)
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [showOnboarding, setShowOnboarding] = useState(false)

  const connectMeta = () => {
    if (isDemoMode) {
      setCampaigns([{ id: '1', name: 'Demo Campaign', objective: 'AWARENESS', status: 'PAUSED' }])
      return
    }

    redirectToEdgeFunction('meta-oauth-start', { workspace_id: currentWorkspaceId })
  }

  const saveOnboarding = async () => {
    if (!currentWorkspaceId) return

    if (isDemoMode) {
      setShowOnboarding(false)
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('meta_ads_onboarding').upsert({
      workspace_id: currentWorkspaceId,
      user_id: user.id,
      answers: onboarding as Json,
    } as never)

    setShowOnboarding(false)
  }

  const generateAds = async () => {
    if (!brief.trim() || !currentWorkspaceId) return

    setGenerating(true)
    try {
      if (isDemoMode) {
        setVariants([
          {
            headline: 'Eco Bottle Pro',
            primary_text: 'Stay hydrated, stay green. Our new bottle keeps drinks cold for 24h.',
            description: 'Sustainable hydration for active lifestyles',
            cta: 'Shop Now',
            image_prompt: 'A sleek stainless steel water bottle on a mountain trail at sunrise',
          },
          {
            headline: 'Your Gym Partner',
            primary_text: 'Zero leaks, maximum performance. Meet the bottle that moves with you.',
            description: 'Engineered for athletes',
            cta: 'Learn More',
            image_prompt: 'Athlete holding a modern water bottle in a gym setting',
          },
        ])
        return
      }

      const { data } = await supabase.functions.invoke('generate-ad-copy', {
        body: { brief, workspace_id: currentWorkspaceId },
      })

      setVariants(((data?.variants as AdVariant[] | undefined) ?? []))
    } finally {
      setGenerating(false)
    }
  }

  const generateImage = async (variant: AdVariant, index: number) => {
    if (isDemoMode) {
      setVariants((prev) =>
        prev.map((item, currentIndex) =>
          currentIndex === index ? { ...item, image_url: 'https://placehold.co/600x400?text=AI+Generated+Ad' } : item
        )
      )
      return
    }

    const { data } = await supabase.functions.invoke('generate-image', {
      body: { prompt: variant.image_prompt },
    })

    setVariants((prev) =>
      prev.map((item, currentIndex) => (currentIndex === index ? { ...item, image_url: data?.url } : item))
    )
  }

  const createAd = async (variant: AdVariant) => {
    if (!currentWorkspaceId) return

    if (isDemoMode) {
      setCampaigns((prev) => [
        ...prev,
        { id: `${Date.now()}`, name: variant.headline, objective: 'AWARENESS', status: 'PAUSED' },
      ])
      return
    }

    await supabase.functions.invoke('meta-ads', {
      body: {
        action: 'create_campaign',
        workspace_id: currentWorkspaceId,
        name: variant.headline,
        objective: 'OUTCOME_AWARENESS',
        status: 'PAUSED',
      },
    })
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Facebook Ads Manager</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={connectMeta}>
            <Link className="mr-2 h-4 w-4" />
            Connect Meta
          </Button>
          <Button variant="outline" onClick={() => setShowOnboarding(true)}>
            Onboarding
          </Button>
        </div>
      </div>

      <Tabs>
        <TabsList className="mb-4">
          <TabsTrigger value="library" activeValue={activeTab} onClick={(value) => setActiveTab(value as AdsTab)}>
            <BookOpen className="mr-2 h-4 w-4" />
            Ads Library
          </TabsTrigger>
          <TabsTrigger value="studio" activeValue={activeTab} onClick={(value) => setActiveTab(value as AdsTab)}>
            <Sparkles className="mr-2 h-4 w-4" />
            AI Ad Studio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" activeValue={activeTab}>
          <div className="space-y-4">
            {campaigns.length === 0 && (
              <Card className="py-12 text-center">
                <CardDescription>No campaigns yet. Use AI Ad Studio to create your first campaign.</CardDescription>
              </Card>
            )}
            {campaigns.map((c) => (
              <Card key={c.id}>
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <CardDescription>{c.objective} • Status: {c.status}</CardDescription>
                  </div>
                  <Badge variant={c.status === 'ACTIVE' ? 'default' : 'secondary'}>{c.status}</Badge>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="studio" activeValue={activeTab}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Ad Studio
              </CardTitle>
              <CardDescription>Describe your campaign and let AI generate variants.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="e.g. Promote our new eco-friendly water bottle to fitness enthusiasts aged 25-40 in the US"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                className="min-h-[100px]"
              />
              <Button onClick={generateAds} disabled={generating || !brief.trim()}>
                {generating ? 'Generating…' : 'Generate variants'}
              </Button>

              {variants.length > 0 && (
                <div className="grid gap-4 pt-4 md:grid-cols-2">
                  {variants.map((v, i) => (
                    <Card key={i} className="overflow-hidden">
                      <div className="h-40 bg-muted">
                        {v.image_url ? (
                          <img src={v.image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            No image yet
                          </div>
                        )}
                      </div>
                      <CardContent className="space-y-2 pt-4">
                        <h4 className="font-semibold">{v.headline}</h4>
                        <p className="text-sm text-muted-foreground">{v.primary_text}</p>
                        <p className="text-xs text-muted-foreground">{v.description}</p>
                        <div className="flex items-center justify-between pt-2">
                          <Badge variant="outline">{v.cta}</Badge>
                          <div className="flex gap-2">
                            {!v.image_url && (
                              <Button size="sm" variant="outline" onClick={() => generateImage(v, i)}>
                                Generate image
                              </Button>
                            )}
                            <Button size="sm" onClick={() => createAd(v)}>
                              Create (Paused)
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showOnboarding} onOpenChange={setShowOnboarding}>
        <DialogHeader>
          <DialogTitle>Ads Onboarding</DialogTitle>
          <DialogDescription>Tell us about your business to improve AI-generated ads.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {[
            { key: 'goal', label: 'Campaign goal', placeholder: 'e.g. Drive website sales' },
            { key: 'audience', label: 'Target audience', placeholder: 'e.g. Women 25-40 interested in fitness' },
            { key: 'landing_url', label: 'Landing page URL', placeholder: 'https://...' },
            { key: 'competitors', label: 'Main competitors', placeholder: 'e.g. Brand A, Brand B' },
            { key: 'brand_voice', label: 'Brand voice', placeholder: 'e.g. Playful, professional, bold' },
          ].map((field) => (
            <div key={field.key} className="space-y-2">
              <label className="text-sm font-medium">{field.label}</label>
              <Input
                placeholder={field.placeholder}
                value={onboarding[field.key] || ''}
                onChange={(e) => setOnboarding((o) => ({ ...o, [field.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowOnboarding(false)}>
            Cancel
          </Button>
          <Button onClick={saveOnboarding}>Save</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
