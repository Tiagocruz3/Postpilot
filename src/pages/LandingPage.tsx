import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, CalendarDays, LayoutDashboard, Sparkles, Wand2 } from 'lucide-react'
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
    ],
    [],
  )

  // If the user is already signed in, the landing page should behave like a fast “continue to app”.
  const primaryCtaHref = profile ? '/app' : '/signup'
  const primaryCtaLabel = profile ? 'Open the app' : 'Start Free Trial'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b bg-background/70 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
              P
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">PostPilot</div>
              <div className="text-[11px] text-muted-foreground">AI social command center</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={(event) => {
                  event.preventDefault()
                  scrollToHash(item.href)
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" className="hidden sm:inline-flex" onClick={() => navigate(profile ? '/app' : '/login')}>
              {profile ? 'Dashboard' : 'Login'}
            </Button>
            <Button onClick={() => navigate(primaryCtaHref)} className="alive-ring">
              {primaryCtaLabel}
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_55%)]" />
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center md:py-20">
            <div className="relative">
              <p className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Create, schedule, post, and advertise from one dashboard.
              </p>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                Your AI Social Media Command Center
              </h1>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Create scroll-stopping posts, AI images, videos, and ad campaigns — then schedule, publish, and track
                everything from one simple dashboard.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button size="lg" onClick={() => navigate(primaryCtaHref)} className="alive-ring">
                  {primaryCtaLabel}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    scrollToHash('#product')
                  }}
                >
                  Watch Demo
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                No credit card required. Create your first AI-powered post in minutes.
              </p>
            </div>

            <div className="relative">
              <div className="rounded-3xl border bg-muted/20 p-3 shadow-sm">
                <div className="rounded-2xl border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Command Center</p>
                    <span className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                      Live preview
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      { label: 'Scheduled content', value: '12' },
                      { label: 'Engagement', value: '+28%' },
                      { label: 'Active ads', value: '3' },
                      { label: 'Leads', value: '47' },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-2xl border bg-muted/20 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                        <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
                        <div className="mt-3 h-2 rounded-full bg-muted">
                          <div className="alive-shimmer h-full w-2/3 rounded-full bg-primary/40" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-2xl border bg-muted/20 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI Suggestions</p>
                    <p className="mt-2 text-sm text-foreground">
                      “Turn your best post into a 3-ad campaign for a lead offer.”
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border bg-background px-3 py-1 text-xs">Generate 3 ads</span>
                      <span className="rounded-full border bg-background px-3 py-1 text-xs">Schedule a week</span>
                      <span className="rounded-full border bg-background px-3 py-1 text-xs">Create video</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pointer-events-none absolute -bottom-10 -right-10 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="border-t bg-muted/10">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-2xl font-semibold tracking-tight">Social media should not take all day</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Most creators and businesses are stuck jumping between AI tools, design apps, schedulers, spreadsheets,
              and ad platforms just to publish one campaign.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                {
                  title: 'Too Many Tools',
                  desc: 'You create content in one app, design in another, schedule somewhere else, then manage ads in Meta.',
                },
                {
                  title: 'No Content Ideas',
                  desc: 'Staring at a blank screen slows everything down and makes posting inconsistent.',
                },
                {
                  title: 'Ads Feel Complicated',
                  desc: 'Campaigns, creatives, audiences, and lead forms shouldn’t require Ads Manager expertise.',
                },
              ].map((card) => (
                <Card key={card.title} className="bg-background">
                  <CardHeader>
                    <CardTitle className="text-base">{card.title}</CardTitle>
                    <CardDescription>{card.desc}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Solution */}
        <section className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_360px] md:items-start">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">One workspace for content, ads, and growth</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                  PostPilot brings your content creation, scheduling, AI generation, ad creation, lead forms, and
                  performance tracking into one beginner-friendly platform.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    'Generate captions, hooks, hashtags, and ad copy with AI',
                    'Create AI images and videos for posts and ads',
                    'Schedule content across your social platforms',
                    'Generate 3 ad options with AI inside Ad Studio',
                    'Launch lead campaigns to Meta/Facebook Ads',
                    'Track posts, ads, leads, and engagement in one dashboard',
                  ].map((text) => (
                    <div key={text} className="flex items-start gap-3 rounded-2xl border bg-muted/10 p-4">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-primary/15 p-[3px]">
                        <div className="h-full w-full rounded-full bg-primary/50" />
                      </div>
                      <p className="text-sm text-foreground">{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Card className="bg-muted/10">
                <CardHeader>
                  <CardTitle className="text-base">Start creating in minutes</CardTitle>
                  <CardDescription>Sign up, generate your first post, and schedule it right away.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" onClick={() => navigate(primaryCtaHref)}>
                    Start Creating Now
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => navigate(profile ? '/app' : '/login')}>
                    {profile ? 'Go to Dashboard' : 'Login'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    By continuing, you agree to our Terms and Privacy Policy.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Product preview */}
        <section id="product" className="border-t bg-muted/10">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-2xl font-semibold tracking-tight">See your whole content engine in one place</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Your Command Center gives you a live view of your posts, engagement, ads, leads, AI credits, and upcoming
              content.
            </p>
            <div className="mt-8 rounded-3xl border bg-background p-4 shadow-sm">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { title: 'Posts created', icon: Wand2, items: ['Ideas → drafts', 'Brand voice', 'Hashtags'] },
                  { title: 'Scheduled content', icon: CalendarDays, items: ['Week view', 'Publishing queue', 'Approvals'] },
                  { title: 'Performance', icon: BarChart3, items: ['Engagement', 'Leads', 'Active ads'] },
                ].map((block) => {
                  const Icon = block.icon
                  return (
                    <div key={block.title} className="rounded-2xl border bg-muted/10 p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <p className="text-sm font-medium">{block.title}</p>
                      </div>
                      <div className="mt-4 space-y-2">
                        {block.items.map((item) => (
                          <div key={item} className="h-9 rounded-xl border bg-background px-3 py-2 text-xs text-muted-foreground">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-2xl font-semibold tracking-tight">Everything you need to create and grow</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                {
                  title: 'Command Center',
                  desc: 'Track posts, engagement, ads, leads, AI usage, and performance from one clean dashboard.',
                  icon: LayoutDashboard,
                },
                {
                  title: 'Create Studio',
                  desc: 'Generate captions, hashtags, ideas, scripts, images, and videos with AI.',
                  icon: Wand2,
                },
                {
                  title: 'Content Calendar',
                  desc: 'Plan, schedule, and organize your posts across multiple social platforms.',
                  icon: CalendarDays,
                },
                {
                  title: 'Ad Studio',
                  desc: 'Generate 3 ad options, edit copy/creative, choose audience, add lead forms, and publish to Meta.',
                  icon: BarChart3,
                },
                {
                  title: 'AI Vault',
                  desc: 'Save your best prompts, brand voice, templates, and reusable content assets.',
                  icon: Sparkles,
                },
                {
                  title: 'Activity Log',
                  desc: 'See post history, edits, published content, ad changes, and usage activity.',
                  icon: LayoutDashboard,
                },
              ].map((feature) => {
                const Icon = feature.icon
                return (
                  <Card key={feature.title} className="bg-background">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-base">{feature.title}</CardTitle>
                      </div>
                      <CardDescription className="mt-2">{feature.desc}</CardDescription>
                    </CardHeader>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>

        {/* Ad Studio Highlight */}
        <section className="border-t bg-muted/10">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_360px] md:items-center">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Build better ads without opening Ads Manager</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Ad Studio turns your product, service, or offer into ready-to-launch Facebook and Instagram ad
                  campaigns.
                </p>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Choose your objective, describe your offer, and let AI generate 3 ad options with copy, creative
                  direction, targeting suggestions, and lead form recommendations.
                </p>
              </div>

              <Card className="bg-background">
                <CardHeader>
                  <CardTitle className="text-base">Ad Studio steps</CardTitle>
                  <CardDescription>From offer → ads in a guided flow.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    'Choose objective',
                    'Add offer',
                    'Generate 3 ad options',
                    'Edit creative',
                    'Publish to Meta Ads',
                  ].map((step, index) => (
                    <div key={step} className="flex items-center gap-3 rounded-xl border bg-muted/10 px-3 py-2">
                      <span
                        className={cn(
                          'inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                          index === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {index + 1}
                      </span>
                      <span className="text-foreground">{step}</span>
                    </div>
                  ))}
                  <Button className="mt-3 w-full" onClick={() => navigate(primaryCtaHref)}>
                    Create My First Ad
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-2xl font-semibold tracking-tight">From idea to published campaign in minutes</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              {[
                { title: 'Describe your goal', desc: 'Tell PostPilot what you want to create, promote, sell, or announce.' },
                { title: 'Generate content', desc: 'Create captions, images, videos, hooks, hashtags, and ad copy with AI.' },
                { title: 'Schedule or launch', desc: 'Publish posts or launch ads through Meta/Facebook Ads.' },
                { title: 'Track and improve', desc: 'Monitor engagement, track leads, and use AI suggestions to improve.' },
              ].map((step, idx) => (
                <Card key={step.title} className="bg-background">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {idx + 1}
                      </span>
                      {step.title}
                    </CardTitle>
                    <CardDescription>{step.desc}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* AI credits */}
        <section className="border-t bg-muted/10">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_360px] md:items-center">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Simple AI credits that keep you in control</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Every plan includes monthly AI credits for text, images, videos, and ads. Need more? Top up anytime.
                  Monthly credits reset each billing cycle, and top-up credits do not expire.
                </p>
              </div>
              <Card className="bg-background">
                <CardHeader>
                  <CardTitle className="text-base">Credits meter</CardTitle>
                  <CardDescription>Preview of what members see in-app.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-2xl border bg-muted/10 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Monthly credits</span>
                      <span className="font-medium">750 / 750</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-muted">
                      <div className="h-full w-[76%] rounded-full bg-primary" />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Resets in 12 days</span>
                      <span>Top-ups never expire</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => scrollToHash('#pricing')}>
                    View Pricing
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-2xl font-semibold tracking-tight">Choose the plan that fits your content engine</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Start free, upgrade when you need more posts, AI credits, images, videos, social accounts, and ad tools.
            </p>
            <div className="mt-8 grid gap-4 lg:grid-cols-5">
              {[
                {
                  name: 'Free',
                  price: '$0',
                  blurb: 'For testing the platform.',
                  items: ['50 AI credits/mo', '10 posts/mo', '5 images/mo', '1 social account', 'No video generation'],
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
                  items: ['2,500 AI credits/mo', '200 posts/mo', '150 images/mo', '12 short videos/mo', '5 social accounts', 'Ad Studio access'],
                  cta: 'Start Pro',
                  popular: true,
                },
                {
                  name: 'Growth',
                  price: '$99',
                  blurb: 'For brands running consistent campaigns.',
                  items: ['7,500 AI credits/mo', '500 posts/mo', '400 images/mo', '30 short videos/mo', '10 social accounts', 'Advanced ads + analytics'],
                  cta: 'Start Growth',
                  popular: false,
                },
                {
                  name: 'Agency',
                  price: '$249',
                  blurb: 'For teams and agencies.',
                  items: ['25,000 AI credits/mo', '1,500 posts/mo', '1,200 images/mo', '100 short videos/mo', '30 social accounts', 'Team workflows'],
                  cta: 'Start Agency',
                  popular: false,
                },
              ].map((plan) => (
                <Card
                  key={plan.name}
                  className={cn(
                    'bg-background',
                    plan.popular ? 'border-primary/40 shadow-sm' : 'border-border',
                  )}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{plan.name}</CardTitle>
                      {plan.popular ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          Most Popular
                        </span>
                      ) : null}
                    </div>
                    <CardDescription>{plan.blurb}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="text-3xl font-semibold tracking-tight">
                        {plan.price}
                        <span className="text-sm font-normal text-muted-foreground">/mo</span>
                      </div>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {plan.items.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/60" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={cn('w-full', plan.popular ? 'alive-ring' : '')}
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

        {/* Social proof */}
        <section className="border-t bg-muted/10">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-2xl font-semibold tracking-tight">Built for creators, businesses, and agencies</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                '“PostPilot helped us turn one campaign idea into a full week of posts and ads in under an hour.”',
                '“The Ad Studio makes creating Facebook campaigns feel simple. The AI options give us a strong starting point every time.”',
                '“We stopped jumping between five different tools. Now our content, ads, and analytics live in one place.”',
              ].map((quote, idx) => (
                <Card key={quote} className="bg-background">
                  <CardContent className="pt-6">
                    <p className="text-sm leading-6 text-foreground">{quote}</p>
                    <p className="mt-4 text-xs text-muted-foreground">Customer #{idx + 1}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="rounded-3xl border bg-primary/5 p-8 md:p-10">
              <h2 className="text-3xl font-semibold tracking-tight">Ready to build your AI content engine?</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Create your first post, generate ad ideas, schedule content, and start growing from one powerful dashboard.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" onClick={() => navigate(primaryCtaHref)} className="alive-ring">
                  {primaryCtaLabel}
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate(profile ? '/app' : '/login')}>
                  {profile ? 'Go to Dashboard' : 'Login'}
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">No credit card required.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-muted/10">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                P
              </div>
              <div>
                <p className="text-sm font-semibold">PostPilot</p>
                <p className="text-xs text-muted-foreground">Your AI-powered social media command center.</p>
              </div>
            </div>
            <p className="mt-4 max-w-xl text-sm text-muted-foreground">
              Create posts, generate images and videos, schedule content, create ads, collect leads, and track performance — all from one dashboard.
            </p>
          </div>

          <div className="grid gap-2 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Product</p>
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
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Support</p>
            <button className="text-left text-muted-foreground hover:text-foreground" onClick={() => navigate('/login')}>
              Account
            </button>
            <button className="text-left text-muted-foreground hover:text-foreground" onClick={() => navigate('/login')}>
              Billing
            </button>
          </div>
        </div>
        <div className="border-t">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} PostPilot. All rights reserved.</p>
            <div className="flex gap-4">
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

