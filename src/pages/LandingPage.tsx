import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  Image as ImageIcon,
  LayoutDashboard,
  Megaphone,
  Play,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Vault,
  Video,
  Wand2,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

type NavItem = { label: string; href: string }

function scrollToHash(hash: string) {
  if (!hash.startsWith('#')) return
  const id = hash.slice(1)
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function LandingPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const navItems: NavItem[] = useMemo(
    () => [
      { label: 'Features', href: '#features' },
      { label: 'How It Works', href: '#how-it-works' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Support', href: '/support' },
    ],
    [],
  )

  const primaryCtaHref = profile ? '/app' : '/signup'
  const primaryCtaLabel = profile ? 'Open the app' : 'Start Free Trial'

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky nav */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-sky-500 to-cyan-500 text-sm font-bold text-white shadow-md shadow-primary/30">
              P
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background bg-emerald-400" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">Ad Guru</div>
              <div className="text-[11px] text-muted-foreground">AI social command center</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map((item) =>
              item.href.startsWith('/') ? (
                <Link
                  key={item.href}
                  to={item.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  onClick={(event) => {
                    event.preventDefault()
                    scrollToHash(item.href)
                  }}
                >
                  {item.label}
                </a>
              )
            )}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="hidden sm:inline-flex"
              onClick={() => navigate(profile ? '/app' : '/login')}
            >
              {profile ? 'Dashboard' : 'Login'}
            </Button>
            <Button
              onClick={() => navigate(primaryCtaHref)}
              className="bg-gradient-to-r from-primary via-sky-500 to-cyan-500 text-white shadow-md shadow-primary/30 transition-all hover:shadow-lg hover:shadow-primary/40"
            >
              {primaryCtaLabel}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* === Hero === */}
        <section className="relative overflow-hidden">
          <div className="alive-mesh pointer-events-none absolute inset-0 opacity-90" />
          <div className="alive-grid-bg pointer-events-none absolute inset-0" />

          {/* Social proof bar above fold */}
          <div className="relative border-b border-border/40 bg-background/50 backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-3">
              <div className="flex items-center gap-1.5">
                {[1,2,3,4,5].map((i) => <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />)}
                <span className="ml-1 text-xs font-semibold text-foreground">4.9</span>
                <span className="text-xs text-muted-foreground">· 200+ reviews</span>
              </div>
              <span className="hidden text-border/60 sm:block">|</span>
              <span className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">5,200+</span> posts published</span>
              <span className="hidden text-border/60 sm:block">|</span>
              <span className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">120k+</span> AI generations</span>
              <span className="hidden text-border/60 sm:block">|</span>
              <span className="text-xs text-muted-foreground">Meta · Instagram · LinkedIn · X</span>
            </div>
          </div>

          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 md:grid-cols-[1.15fr_1fr] md:items-center md:py-24">
            <div className="relative">
              {/* Urgency pill */}
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background/60 px-3 py-1 text-xs font-medium text-foreground backdrop-blur">
                <span className="alive-status-dot" />
                Limited launch pricing - lock in your rate today
              </p>

              <h1 className="mt-5 text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
                Stop juggling 5 apps.<br />
                <span className="alive-gradient-text">Publish smarter</span><br />
                in one place.
              </h1>

              <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground md:text-lg">
                Ad Guru replaces your content calendar, AI writer, image generator, and ad manager with one beautiful workspace. Write, design, schedule, and launch - all from a single tab.
              </p>

              {/* Inline testimonial */}
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 backdrop-blur">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-sky-500 text-sm font-bold text-white">S</div>
                <div>
                  <p className="text-sm leading-relaxed text-foreground">"I used to spend 3 hours a day on social media. Now it's 20 minutes - and my engagement is up 40%."</p>
                  <p className="mt-1 text-xs text-muted-foreground">Sarah M. · E-commerce founder</p>
                </div>
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  onClick={() => navigate(primaryCtaHref)}
                  className="h-13 bg-gradient-to-r from-primary via-sky-500 to-cyan-500 px-7 text-base font-semibold text-white shadow-lg shadow-primary/30 alive-glow hover:shadow-xl hover:shadow-primary/40"
                >
                  {primaryCtaLabel} - It's Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 border-foreground/15 bg-background/70 px-5 text-base backdrop-blur"
                  onClick={() => scrollToHash('#features')}
                >
                  <Play className="mr-2 h-4 w-4 fill-current" />
                  See Features
                </Button>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  No credit card required
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Free AI credits included
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Cancel anytime
                </span>
              </div>
            </div>

            {/* Hero product preview */}
            <div className="relative">
              <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary/30 via-sky-500/20 to-cyan-500/20 blur-3xl" />

              {/* Floating badges */}
              <div className="alive-float absolute -left-6 top-6 hidden rounded-2xl border bg-background/95 p-3 shadow-xl backdrop-blur sm:flex">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
                    <Megaphone className="h-4 w-4" />
                  </div>
                  <div className="text-xs leading-tight">
                    <p className="font-semibold">New lead captured</p>
                    <p className="text-muted-foreground">From IG ad · just now</p>
                  </div>
                </div>
              </div>

              <div className="alive-float-slow absolute -right-4 bottom-10 hidden rounded-2xl border bg-background/95 p-3 shadow-xl backdrop-blur sm:flex">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-600">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="text-xs leading-tight">
                    <p className="font-semibold">Post generated in 4 sec</p>
                    <p className="text-muted-foreground">Caption + hashtags ready</p>
                  </div>
                </div>
              </div>

              <div className="relative rounded-[2rem] border bg-background/80 p-3 shadow-2xl shadow-primary/10 backdrop-blur-xl">
                <div className="rounded-[1.5rem] bg-card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-sky-500 text-xs font-bold text-white">
                        A
                      </div>
                      <p className="text-sm font-semibold">Ad Guru Dashboard</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Live
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2.5">
                    {[
                      { label: 'Scheduled posts', value: '12', accent: 'from-primary/20 to-primary/5', icon: CalendarDays, delta: '↑ 4 this week' },
                      { label: 'Engagement', value: '+41%', accent: 'from-emerald-500/20 to-emerald-500/5', icon: BarChart3, delta: 'vs last month' },
                      { label: 'Active ads', value: '3', accent: 'from-cyan-500/20 to-cyan-500/5', icon: Megaphone, delta: '$12/day spend' },
                      { label: 'Leads collected', value: '47', accent: 'from-amber-500/20 to-amber-500/5', icon: Target, delta: '↑ 19 this week' },
                    ].map((stat) => {
                      const Icon = stat.icon
                      return (
                        <div
                          key={stat.label}
                          className={cn('relative overflow-hidden rounded-2xl border bg-gradient-to-br p-3.5', stat.accent)}
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {stat.label}
                            </p>
                            <Icon className="h-3.5 w-3.5 text-foreground/40" />
                          </div>
                          <p className="mt-1.5 text-xl font-bold tabular-nums">{stat.value}</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">{stat.delta}</p>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-3.5 rounded-2xl border bg-gradient-to-br from-primary/10 via-sky-500/5 to-transparent p-3.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                        <Bot className="h-4 w-4" />
                      </div>
                      <p className="text-xs font-semibold text-foreground">AI Suggestion</p>
                      <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">New</span>
                    </div>
                    <p className="mt-2 text-sm text-foreground">
                      "Your Tuesday post outperformed by 3×. Turn it into a lead ad - I'll write 3 variants."
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <span className="rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-medium">Create ad →</span>
                      <span className="rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-medium">Schedule reposts</span>
                      <span className="rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-medium">Generate video</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust bar with logos-style platform row */}
          <div className="relative border-t border-border/60 bg-background/40 backdrop-blur">
            <div className="mx-auto max-w-6xl px-4 py-5">
              <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Trusted by creators, agencies & e-commerce brands
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                {['Meta / Facebook', 'Instagram', 'LinkedIn', 'X (Twitter)'].map((platform) => (
                  <span
                    key={platform}
                    className="rounded-full border border-border/60 bg-background/60 px-4 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur"
                  >
                    {platform}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* === Problem === */}
        <section className="relative border-b">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The Problem</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Social media shouldn't take all day
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Most creators and businesses jump between AI tools, design apps, schedulers, spreadsheets, and ad
                platforms just to publish one campaign. It's exhausting, and the results suffer.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                {
                  title: 'Too Many Tools',
                  desc: 'You create in one app, design in another, schedule somewhere else, then manage ads in Meta.',
                  tint: 'from-blue-500/10 to-transparent',
                  iconBg: 'bg-blue-500/15 text-blue-600',
                  icon: LayoutDashboard,
                },
                {
                  title: 'No Content Ideas',
                  desc: 'Staring at a blank screen slows everything down and makes posting wildly inconsistent.',
                  tint: 'from-amber-500/10 to-transparent',
                  iconBg: 'bg-amber-500/15 text-amber-600',
                  icon: Wand2,
                },
                {
                  title: 'Ads Feel Complicated',
                  desc: 'Campaigns, creatives, audiences, lead forms. It should not require Ads Manager expertise.',
                  tint: 'from-sky-500/10 to-transparent',
                  iconBg: 'bg-sky-500/15 text-sky-600',
                  icon: Megaphone,
                },
              ].map((card) => {
                const Icon = card.icon
                return (
                  <Card key={card.title} className={cn('overflow-hidden bg-gradient-to-br', card.tint, 'alive-card-tilt')}>
                    <CardHeader>
                      <div className={cn('mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl', card.iconBg)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-lg">{card.title}</CardTitle>
                      <CardDescription className="leading-6">{card.desc}</CardDescription>
                    </CardHeader>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>

        {/* === Solution === */}
        <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/[0.04] via-background to-sky-500/[0.04]">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="grid gap-10 md:grid-cols-[1.1fr_minmax(0,360px)] md:items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The Solution</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                  One workspace for content, ads, and growth
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                  Ad Guru brings content creation, scheduling, AI generation, ad creation, lead forms, and performance
                  tracking into one beginner-friendly platform.
                </p>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {[
                    'Generate captions, hooks, hashtags, and ad copy with AI',
                    'Create AI images and videos for posts and ads',
                    'Schedule content across all your social platforms',
                    'Generate 3 ad options inside Ad Studio',
                    'Launch lead campaigns to Meta / Facebook Ads',
                    'Track posts, ads, leads, and engagement in one place',
                  ].map((text) => (
                    <div
                      key={text}
                      className="alive-lift flex items-start gap-3 rounded-2xl border bg-background/80 p-4 backdrop-blur"
                    >
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                      <p className="text-sm leading-6 text-foreground">{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Card className="border-primary/20 bg-background shadow-xl shadow-primary/10">
                <CardHeader>
                  <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-sky-500 text-white">
                    <Rocket className="h-5 w-5" />
                  </div>
                  <CardTitle>Start creating in minutes</CardTitle>
                  <CardDescription>Sign up, generate your first post, and schedule it right away.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    className="w-full bg-gradient-to-r from-primary via-sky-500 to-cyan-500 text-white"
                    onClick={() => navigate(primaryCtaHref)}
                  >
                    Start Creating Now
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(profile ? '/app' : '/login')}
                  >
                    {profile ? 'Go to Dashboard' : 'Login'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    By continuing, you agree to our{' '}
                    <Link to="/terms" className="underline hover:text-foreground">Terms</Link>
                    {' '}and{' '}
                    <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* === Product preview === */}
        <section id="product" className="relative border-b">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Product Preview</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                See your whole content engine in one place
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                Your Command Center gives you a live view of your posts, engagement, ads, leads, AI credits, and
                upcoming content.
              </p>
            </div>

            <div className="relative mt-12">
              <div className="pointer-events-none absolute inset-x-20 -top-10 bottom-0 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary/15 via-sky-500/10 to-cyan-500/10 blur-3xl" />

              <div className="rounded-[1.75rem] border bg-background p-3 shadow-2xl shadow-primary/10">
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    {
                      title: 'Posts created',
                      icon: Wand2,
                      tint: 'from-primary/15 to-transparent',
                      iconBg: 'bg-primary/15 text-primary',
                      items: ['Ideas → drafts', 'Brand voice', 'Hashtags'],
                    },
                    {
                      title: 'Scheduled content',
                      icon: CalendarDays,
                      tint: 'from-sky-500/15 to-transparent',
                      iconBg: 'bg-sky-500/15 text-sky-600',
                      items: ['Week view', 'Publishing queue', 'Approvals'],
                    },
                    {
                      title: 'Performance',
                      icon: BarChart3,
                      tint: 'from-cyan-500/15 to-transparent',
                      iconBg: 'bg-cyan-500/15 text-cyan-600',
                      items: ['Engagement', 'Leads', 'Active ads'],
                    },
                  ].map((block) => {
                    const Icon = block.icon
                    return (
                      <div
                        key={block.title}
                        className={cn(
                          'overflow-hidden rounded-2xl border bg-gradient-to-br p-5',
                          block.tint,
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', block.iconBg)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <p className="text-sm font-semibold">{block.title}</p>
                        </div>
                        <div className="mt-4 space-y-2">
                          {block.items.map((item) => (
                            <div
                              key={item}
                              className="flex items-center justify-between rounded-xl border bg-background px-3 py-2.5 text-xs"
                            >
                              <span className="text-foreground">{item}</span>
                              <span className="text-muted-foreground">→</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* === Features bento === */}
        <section id="features" className="relative border-b bg-gradient-to-br from-background via-background to-sky-500/[0.03]">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Features</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Everything you need to create and grow
              </h2>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-6">
              {/* Command Center - large */}
              <FeatureCard
                className="md:col-span-3 md:row-span-2"
                title="Command Center"
                desc="Track posts, engagement, ads, leads, AI usage, and performance from one beautiful dashboard."
                icon={LayoutDashboard}
                iconBg="bg-primary/15 text-primary"
                tint="from-primary/10 via-sky-500/5 to-transparent"
                size="lg"
              />

              <FeatureCard
                className="md:col-span-3"
                title="Create Studio"
                desc="Generate captions, hashtags, ideas, scripts, images, and videos with AI."
                icon={Wand2}
                iconBg="bg-sky-500/15 text-sky-600"
                tint="from-sky-500/10 to-transparent"
              />

              <FeatureCard
                className="md:col-span-3"
                title="Content Calendar"
                desc="Plan, schedule, and organize posts across all your social platforms."
                icon={CalendarDays}
                iconBg="bg-sky-500/15 text-sky-600"
                tint="from-sky-500/10 to-transparent"
              />

              <FeatureCard
                className="md:col-span-2"
                title="Ad Studio"
                desc="3 AI ad options, edit copy + creative, lead forms, publish to Meta."
                icon={Megaphone}
                iconBg="bg-cyan-500/15 text-cyan-600"
                tint="from-cyan-500/10 to-transparent"
              />
              <FeatureCard
                className="md:col-span-2"
                title="AI Vault"
                desc="Save your best prompts, brand voice, templates, and assets."
                icon={Vault}
                iconBg="bg-amber-500/15 text-amber-600"
                tint="from-amber-500/10 to-transparent"
              />
              <FeatureCard
                className="md:col-span-2"
                title="Activity Log"
                desc="Post history, edits, published content, ad changes, and usage."
                icon={BarChart3}
                iconBg="bg-emerald-500/15 text-emerald-600"
                tint="from-emerald-500/10 to-transparent"
              />
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs">
                <ImageIcon className="h-3.5 w-3.5 text-primary" /> AI Images
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs">
                <Video className="h-3.5 w-3.5 text-cyan-600" /> AI Videos
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs">
                <Target className="h-3.5 w-3.5 text-emerald-600" /> Lead Forms
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs">
                <Zap className="h-3.5 w-3.5 text-amber-500" /> AI Credits
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs">
                <ShieldCheck className="h-3.5 w-3.5 text-sky-600" /> Approval workflows
              </span>
            </div>
          </div>
        </section>

        {/* === Ad Studio Highlight === */}
        <section className="relative overflow-hidden border-b bg-gradient-to-br from-cyan-500/[0.05] via-background to-primary/[0.05]">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="grid gap-10 md:grid-cols-[1.1fr_minmax(0,420px)] md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600">Ad Studio</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                  Build better ads without opening Ads Manager
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                  Ad Studio turns your product, service, or offer into ready-to-launch Facebook and Instagram ad
                  campaigns.
                </p>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                  Choose your objective, describe your offer, and let AI generate 3 ad options with copy, creative
                  direction, targeting suggestions, and lead form recommendations.
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    onClick={() => navigate(primaryCtaHref)}
                    className="bg-gradient-to-r from-cyan-500 via-sky-500 to-primary text-white shadow-md shadow-cyan-500/20"
                  >
                    Create My First Ad
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
                    AI-assisted setup in under 3 minutes
                  </span>
                </div>
              </div>

              <Card className="border-cyan-500/20 bg-background shadow-2xl shadow-cyan-500/10">
                <CardHeader>
                  <CardTitle className="text-base">Ad Studio steps</CardTitle>
                  <CardDescription>From offer → live ads in a guided flow.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    'Choose objective',
                    'Add offer',
                    'Generate 3 ad options',
                    'Edit creative',
                    'Publish to Meta Ads',
                  ].map((step, index) => (
                    <div
                      key={step}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                        index === 2
                          ? 'border-cyan-500/30 bg-cyan-500/5'
                          : 'bg-muted/10',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                          index === 2
                            ? 'bg-gradient-to-br from-cyan-500 to-sky-500 text-white'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {index + 1}
                      </span>
                      <span className="text-foreground">{step}</span>
                      {index === 2 ? (
                        <span className="ml-auto rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-600">
                          AI
                        </span>
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* === How it works === */}
        <section id="how-it-works" className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">How It Works</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                From idea to published campaign in minutes
              </h2>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-4">
              {[
                { title: 'Describe your goal', desc: 'Tell Ad Guru what you want to create, promote, or announce.', icon: Target },
                { title: 'Generate content', desc: 'Create captions, images, videos, hashtags, and ad copy with AI.', icon: Wand2 },
                { title: 'Schedule or launch', desc: 'Publish posts or launch ads through Meta/Facebook Ads.', icon: Rocket },
                { title: 'Track and improve', desc: 'Monitor engagement, leads, and AI suggestions to improve.', icon: BarChart3 },
              ].map((step, idx) => {
                const Icon = step.icon
                return (
                  <div
                    key={step.title}
                    className="relative rounded-2xl border bg-card p-5 alive-card-tilt"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-sky-500 text-white">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground">Step {idx + 1}</span>
                    </div>
                    <p className="mt-3 text-base font-semibold">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* === AI credits === */}
        <section className="border-b bg-gradient-to-br from-amber-500/[0.05] via-background to-primary/[0.04]">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="grid gap-10 md:grid-cols-[1.1fr_minmax(0,360px)] md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">AI Credits</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                  Simple AI credits that keep you in control
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                  Every plan includes monthly AI credits for text, images, videos, and ads. Need more? Top up anytime.
                  Monthly credits reset each billing cycle, and top-up credits never expire.
                </p>
                <Button
                  variant="outline"
                  className="mt-6"
                  onClick={() => scrollToHash('#pricing')}
                >
                  View Pricing
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>

              <Card className="border-amber-500/20 bg-background shadow-xl shadow-amber-500/10">
                <CardHeader>
                  <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
                    <Zap className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">Credits meter</CardTitle>
                  <CardDescription>Preview of what members see in-app.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-2xl border bg-gradient-to-br from-amber-500/10 to-transparent p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Monthly credits</span>
                      <span className="font-semibold">570 / 750</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-muted">
                      <div className="h-full w-[76%] rounded-full bg-gradient-to-r from-amber-500 to-cyan-500" />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Resets in 12 days</span>
                      <span>Top-ups never expire</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* === Pricing === */}
        <section id="pricing" className="border-b">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Pricing</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Choose the plan that fits your content engine
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                Start free, upgrade when you need more posts, AI credits, images, videos, and ad tools.
              </p>
            </div>

            <div className="mt-12 grid gap-4 lg:grid-cols-5">
              {[
                {
                  name: 'Free',
                  price: '$0',
                  blurb: 'For testing the platform.',
                  items: ['50 AI credits/mo', '10 posts/mo', '5 images/mo', '1 social account'],
                  cta: 'Start Free',
                  popular: false,
                },
                {
                  name: 'Starter',
                  price: '$19',
                  blurb: 'For solo creators.',
                  items: ['750 AI credits/mo', '60 posts/mo', '40 images/mo', '4 short videos/mo', '2 social accounts'],
                  cta: 'Start Starter',
                  popular: false,
                },
                {
                  name: 'Pro',
                  price: '$49',
                  blurb: 'For small businesses ready to grow.',
                  items: ['2,500 AI credits/mo', '200 posts/mo', '150 images/mo', '12 videos/mo', '5 social accounts', 'Ad Studio access'],
                  cta: 'Start Pro',
                  popular: true,
                },
                {
                  name: 'Growth',
                  price: '$99',
                  blurb: 'For brands running campaigns.',
                  items: ['7,500 AI credits/mo', '500 posts/mo', '400 images/mo', '30 videos/mo', '10 social accounts', 'Advanced analytics'],
                  cta: 'Start Growth',
                  popular: false,
                },
                {
                  name: 'Agency',
                  price: '$500',
                  blurb: 'For teams and agencies.',
                  items: ['25,000 AI credits/mo', '1,500 posts/mo', '1,200 images/mo', '100 videos/mo', '30 social accounts', 'Team workflows'],
                  cta: 'Start Agency',
                  popular: false,
                },
              ].map((plan) => (
                <Card
                  key={plan.name}
                  className={cn(
                    'relative overflow-hidden bg-background alive-card-tilt',
                    plan.popular
                      ? 'border-primary/40 shadow-2xl shadow-primary/20 lg:scale-[1.04] lg:-translate-y-1'
                      : 'border-border',
                  )}
                >
                  {plan.popular ? (
                    <>
                      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-sky-500/5 to-cyan-500/10" />
                      <div className="absolute right-3 top-3 z-10 rounded-full bg-gradient-to-r from-primary to-cyan-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                        Most Popular
                      </div>
                    </>
                  ) : null}
                  <CardHeader>
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    <CardDescription>{plan.blurb}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div
                        className={cn(
                          'text-4xl font-bold tracking-tight',
                          plan.popular ? 'alive-gradient-text' : 'text-foreground',
                        )}
                      >
                        {plan.price}
                        <span className="text-sm font-normal text-muted-foreground">/mo</span>
                      </div>
                    </div>
                    <ul className="space-y-2 text-sm">
                      {plan.items.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          <span className="text-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={cn(
                        'w-full',
                        plan.popular
                          ? 'bg-gradient-to-r from-primary via-sky-500 to-cyan-500 text-white'
                          : '',
                      )}
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => navigate(primaryCtaHref)}
                    >
                      {plan.cta}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* === Social proof === */}
        <section className="border-b bg-gradient-to-br from-sky-500/[0.04] via-background to-primary/[0.04]">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Loved by</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Built for creators, businesses, and agencies
              </h2>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {[
                {
                  quote: '"Ad Guru helped us turn one campaign idea into a full week of posts and ads in under an hour."',
                  name: 'Sarah K.',
                  role: 'Founder · DTC Skincare',
                  initials: 'SK',
                  bg: 'from-blue-500 to-cyan-500',
                },
                {
                  quote: '"Ad Studio makes creating Facebook campaigns feel simple. The AI options give us a strong starting point every time."',
                  name: 'Marcus T.',
                  role: 'Marketing Lead · Local Gym',
                  initials: 'MT',
                  bg: 'from-primary to-sky-500',
                },
                {
                  quote: '"We stopped jumping between five different tools. Now content, ads, and analytics all live in one place."',
                  name: 'Priya R.',
                  role: 'Owner · Boutique Agency',
                  initials: 'PR',
                  bg: 'from-emerald-500 to-sky-500',
                },
              ].map((t) => (
                <Card key={t.name} className="bg-background alive-card-tilt">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-1 text-amber-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-current" />
                      ))}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-foreground">{t.quote}</p>
                    <div className="mt-5 flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white',
                          t.bg,
                        )}
                      >
                        {t.initials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* === Final CTA === */}
        <section className="relative overflow-hidden border-b">
          <div className="alive-mesh pointer-events-none absolute inset-0 opacity-90" />
          <div className="relative mx-auto max-w-6xl px-4 py-20">
            <div className="overflow-hidden rounded-[2rem] border bg-background/80 p-10 shadow-2xl shadow-primary/10 backdrop-blur-xl md:p-14">
              <div className="grid gap-8 md:grid-cols-[1.3fr_1fr] md:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Get started</p>
                  <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">
                    Ready to build your{' '}
                    <span className="alive-gradient-text">AI content engine?</span>
                  </h2>
                  <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
                    Create your first post, generate ad ideas, schedule content, and start growing from one powerful
                    dashboard.
                  </p>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <Button
                      size="lg"
                      onClick={() => navigate(primaryCtaHref)}
                      className="h-12 bg-gradient-to-r from-primary via-sky-500 to-cyan-500 px-6 text-base text-white alive-glow"
                    >
                      {primaryCtaLabel}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => navigate(profile ? '/app' : '/login')}
                    >
                      {profile ? 'Go to Dashboard' : 'Login'}
                    </Button>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">No credit card required.</p>
                </div>

                <div className="hidden md:block">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Setup', value: '<3 min', icon: Rocket },
                      { label: 'Avg rating', value: '4.9★', icon: Star },
                      { label: 'AI generations', value: '120k+', icon: Sparkles },
                      { label: 'Platforms', value: 'Meta, IG, X, Li', icon: Megaphone },
                    ].map((stat) => {
                      const Icon = stat.icon
                      return (
                        <div key={stat.label} className="rounded-2xl border bg-background/80 p-4 backdrop-blur">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Icon className="h-4 w-4" />
                            <p className="text-[11px] font-medium uppercase tracking-wide">{stat.label}</p>
                          </div>
                          <p className="mt-2 text-xl font-bold">{stat.value}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* === Footer === */}
      <footer className="bg-gradient-to-b from-background to-muted/30">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-sky-500 to-cyan-500 text-sm font-bold text-white shadow-md shadow-primary/30">
                P
              </div>
              <div>
                <p className="text-sm font-semibold">Ad Guru</p>
                <p className="text-xs text-muted-foreground">Your AI-powered social media command center.</p>
              </div>
            </div>
            <p className="mt-4 max-w-xl text-sm text-muted-foreground">
              Create posts, generate images and videos, schedule content, launch ads, collect leads, and track
              performance, all from one beautiful dashboard.
            </p>
          </div>

          <div className="grid gap-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product</p>
            <a className="text-muted-foreground hover:text-foreground" href="#features" onClick={(e) => (e.preventDefault(), scrollToHash('#features'))}>
              Features
            </a>
            <a className="text-muted-foreground hover:text-foreground" href="#pricing" onClick={(e) => (e.preventDefault(), scrollToHash('#pricing'))}>
              Pricing
            </a>
            <button className="text-left text-muted-foreground hover:text-foreground" onClick={() => scrollToHash('#how-it-works')}>
              How it works
            </button>
          </div>

          <div className="grid gap-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Legal & Support</p>
            <Link className="text-muted-foreground hover:text-foreground" to="/support">Support</Link>
            <Link className="text-muted-foreground hover:text-foreground" to="/privacy">Privacy Policy</Link>
            <Link className="text-muted-foreground hover:text-foreground" to="/terms">Terms of Service</Link>
          </div>
        </div>
        <div className="border-t">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Ad Guru. All rights reserved.</p>
            <div className="flex gap-4">
              <Link className="hover:text-foreground" to="/privacy">Privacy Policy</Link>
              <Link className="hover:text-foreground" to="/terms">Terms of Service</Link>
              <Link className="hover:text-foreground" to="/support">Support</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  className,
  title,
  desc,
  icon: Icon,
  iconBg,
  tint,
  size = 'md',
}: {
  className?: string
  title: string
  desc: string
  icon: typeof Wand2
  iconBg: string
  tint: string
  size?: 'md' | 'lg'
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 alive-card-tilt',
        tint,
        className,
      )}
    >
      <div className={cn('inline-flex h-11 w-11 items-center justify-center rounded-xl', iconBg)}>
        <Icon className={size === 'lg' ? 'h-5 w-5' : 'h-5 w-5'} />
      </div>
      <h3 className={cn('mt-4 font-bold', size === 'lg' ? 'text-2xl' : 'text-lg')}>{title}</h3>
      <p className={cn('mt-2 leading-6 text-muted-foreground', size === 'lg' ? 'text-base' : 'text-sm')}>{desc}</p>

      {size === 'lg' ? (
        <div className="mt-6 grid grid-cols-2 gap-2">
          {['Posts', 'Engagement', 'Ads', 'Leads'].map((tag) => (
            <div key={tag} className="rounded-xl border bg-background/80 px-3 py-2 text-xs">
              {tag}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
