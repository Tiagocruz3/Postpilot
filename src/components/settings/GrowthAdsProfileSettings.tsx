import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, Megaphone, RefreshCcw, RotateCcw, Sparkles } from 'lucide-react'
import { useConfirm } from '@/components/ConfirmProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { APP_PAGE } from '@/lib/app-labels'
import {
  ADS_PROFILE_SECTIONS,
  computeAdsProfileCompletion,
  createDefaultAdsStudioProfile,
  fetchAdsStudioProfile,
  isAdsOnboardingComplete,
  resetAdsStudioProfile,
  type AdsStudioProfile,
} from '@/lib/ads-studio-profile'
import { isDemoMode } from '@/lib/demo'

type GrowthAdsProfileSettingsProps = {
  workspaceId: string | null
  userId: string | undefined
  onMessage?: (message: string) => void
}

export function GrowthAdsProfileSettings({ workspaceId, userId, onMessage }: GrowthAdsProfileSettingsProps) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [profile, setProfile] = useState<AdsStudioProfile | null>(null)

  const reload = async () => {
    if (!userId) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      if (isDemoMode) {
        setProfile(createDefaultAdsStudioProfile(userId))
        return
      }
      const saved = await fetchAdsStudioProfile(workspaceId, userId)
      setProfile(saved ?? createDefaultAdsStudioProfile(userId))
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : 'Could not load Growth Ads profile.')
      setProfile(userId ? createDefaultAdsStudioProfile(userId) : null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [workspaceId, userId])

  const completion = useMemo(() => (profile ? computeAdsProfileCompletion(profile) : 0), [profile])
  const onboardingComplete = profile ? isAdsOnboardingComplete(profile) : false

  const handleResetOnboarding = async () => {
    if (!workspaceId || !userId) {
      onMessage?.('Select a workspace first.')
      return
    }

    const confirmed = await confirm({
      title: 'Reset Growth Ads onboarding?',
      description:
        'This clears your business, audience, offer, brand voice, and creative preferences for this workspace. Meta account connections are kept. You can walk through onboarding again or edit your profile afterward.',
      confirmLabel: 'Reset & re-onboard',
      variant: 'destructive',
    })
    if (!confirmed) return

    setResetting(true)
    try {
      if (isDemoMode) {
        setProfile(createDefaultAdsStudioProfile(userId))
      } else {
        const fresh = await resetAdsStudioProfile(workspaceId, userId)
        setProfile(fresh)
      }
      onMessage?.('Growth Ads profile reset. Opening onboarding…')
      navigate('/app/ads?onboarding=1')
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : 'Could not reset Growth Ads profile.')
    } finally {
      setResetting(false)
    }
  }

  const openOnboarding = () => {
    navigate('/app/ads?onboarding=1')
  }

  const openProfileEditor = () => {
    navigate('/app/ads?editProfile=1')
  }

  if (!workspaceId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            {APP_PAGE.growthAds}
          </CardTitle>
          <CardDescription>Select a workspace to manage your Growth Ads AI profile.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            {APP_PAGE.growthAds} profile
          </CardTitle>
          <CardDescription>
            Your AI profile powers audience suggestions, ad copy, and campaign defaults. Review progress here, edit
            details, or reset and run onboarding again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading profile…</p>
          ) : profile ? (
            <>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Profile completion</p>
                  <Badge variant={onboardingComplete ? 'default' : 'secondary'}>{completion}%</Badge>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[#1877F2] transition-all"
                    style={{ width: `${Math.max(4, completion)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {onboardingComplete
                    ? 'Onboarding complete - campaigns use this context automatically.'
                    : 'Finish onboarding in Growth Ads for better AI recommendations.'}
                </p>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4 space-y-2 text-sm">
                <p className="font-medium">{profile.businessProfile.businessName || 'Business name not set'}</p>
                <p className="text-muted-foreground">
                  {profile.businessProfile.industry || 'Industry'} · {profile.audienceProfile.locations || 'No location yet'}
                </p>
                <p className="text-muted-foreground line-clamp-2">
                  {profile.offerProfile.mainOffer || profile.offerProfile.mainProductService || 'No offer set yet'}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Checklist</p>
                <ul className="space-y-2">
                  {ADS_PROFILE_SECTIONS.map((section) => {
                    const done = section.check(profile)
                    return (
                      <li key={section.key} className="flex items-center gap-2 text-sm">
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#1877F2]" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className={done ? 'text-foreground' : 'text-muted-foreground'}>{section.label}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={openProfileEditor}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Edit profile in {APP_PAGE.growthAds}
                </Button>
                <Button type="button" variant="outline" onClick={openOnboarding}>
                  Review onboarding steps
                </Button>
                <Button type="button" variant="outline" onClick={() => void reload()} disabled={loading}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-destructive/30 xl:self-start">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Re-onboard</CardTitle>
          <CardDescription>
            Clear Growth Ads profile data for this workspace and start the setup wizard from step one. OAuth connections
            to Facebook/Meta are not removed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            disabled={resetting || loading || !userId}
            onClick={() => void handleResetOnboarding()}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {resetting ? 'Resetting…' : 'Reset profile & re-onboard'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
