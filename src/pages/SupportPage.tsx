import { useState } from 'react'
import { Link } from 'react-router-dom'

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How do I connect my Facebook or Instagram account?',
    a: 'Go to Settings → Connected Accounts and click "Connect Facebook / Instagram". You will be redirected to Meta to authorise Ad Guru. Make sure you are an admin of the Facebook Page or Instagram Business account you want to connect.',
  },
  {
    q: 'How do AI credits work?',
    a: 'Each plan includes a monthly AI credit allocation that resets on your billing date. Credits are consumed when you generate captions, ad copy, images, or videos. Top-up credit packs are also available and never expire. You can track your remaining credits in the Command Center dashboard.',
  },
  {
    q: 'Can I schedule posts to multiple platforms at once?',
    a: 'Yes. When composing a post, select all the social accounts you want to publish to, set your date and time, and click "Schedule". Ad Guru will publish to each connected account at the scheduled time.',
  },
  {
    q: 'Why was my post not published at the scheduled time?',
    a: 'The most common reasons are an expired or disconnected social account token, platform-side rate limiting, or content that was rejected by the platform\'s policy filters. Check the History page for error details and re-connect your account in Settings if needed.',
  },
  {
    q: 'How do I cancel or change my subscription?',
    a: 'You can upgrade, downgrade, or cancel your subscription at any time from Settings → Billing. Cancellations take effect at the end of the current billing period — you keep full access until then.',
  },
  {
    q: 'Can I get a refund?',
    a: 'We offer a full refund within 14 days of your first payment on any paid plan. After that period, payments are non-refundable except where required by applicable law. Contact support@adguru.app and we\'ll be happy to help.',
  },
  {
    q: 'What social platforms does Ad Guru support?',
    a: 'Ad Guru currently supports Facebook Pages, Instagram Business accounts, LinkedIn, and X (Twitter). More platforms are on the roadmap. You can connect and manage multiple accounts across all supported platforms.',
  },
  {
    q: 'Is my data secure? Are my social tokens stored safely?',
    a: 'Yes. All OAuth access tokens for connected social accounts are encrypted at rest using AES-256 and in transit via TLS. We never store your social media passwords. You can revoke access at any time from Settings → Connected Accounts.',
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <button
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/30"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span>{q}</span>
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-transform duration-200"
          style={{ transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}
          aria-hidden
        >
          +
        </span>
      </button>
      {open && (
        <div className="border-t border-border bg-muted/20 px-5 py-4 text-sm leading-7 text-muted-foreground">
          {a}
        </div>
      )}
    </div>
  )
}

export function SupportPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky nav */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-sky-500 to-cyan-500 text-sm font-bold text-white shadow-md shadow-primary/30">
              P
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">Ad Guru</div>
              <div className="text-[11px] text-muted-foreground">AI social command center</div>
            </div>
          </Link>
          <Link
            to="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12">

        {/* Hero */}
        <div className="mb-14 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-sky-500 to-cyan-500 text-white shadow-lg shadow-primary/30">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">We're here to help</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            Browse the guides below, check the FAQ, or reach out to our team directly. We typically reply within one business day.
          </p>
        </div>

        {/* Three cards */}
        <div className="mb-16 grid gap-4 sm:grid-cols-3">
          {/* Getting Started */}
          <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-sky-500/5 to-transparent p-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
              </svg>
            </div>
            <h2 className="mb-2 text-base font-semibold">Getting Started</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              New to Ad Guru? Learn how to connect your social accounts, generate your first post with AI, and schedule it in minutes.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                Create your account
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                Connect a social platform
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                Generate your first post
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                Schedule and publish
              </li>
            </ul>
          </div>

          {/* Common Issues */}
          <div className="rounded-2xl border border-border bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h2 className="mb-2 text-base font-semibold">Common Issues</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Running into a problem? Here are the most common issues and how to resolve them quickly.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/60" />
                Post failed to publish
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/60" />
                Social account disconnected
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/60" />
                AI credit questions
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/60" />
                Billing and invoice queries
              </li>
            </ul>
          </div>

          {/* Contact Us */}
          <div className="rounded-2xl border border-border bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
            </div>
            <h2 className="mb-2 text-base font-semibold">Contact Us</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Can't find what you're looking for? Our support team is ready to help. We typically respond within one business day.
            </p>
            <a
              href="mailto:support@adguru.app"
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              Email support@adguru.app
            </a>
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-16">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">FAQ</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Frequently asked questions</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Quick answers to the questions we hear most often. Still stuck? Email us anytime.
            </p>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>

        {/* Contact CTA card */}
        <div className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-sky-500/5 to-cyan-500/10 p-8 text-center shadow-xl shadow-primary/10 md:p-12">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-sky-500 to-cyan-500 text-white shadow-md shadow-primary/30">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.712 4.33a9.027 9.027 0 0 1 1.652 1.306c.51.51.944 1.064 1.306 1.652M16.712 4.33l-3.448 4.138m3.448-4.138a9.014 9.014 0 0 0-9.424 0M19.67 7.288l-4.138 3.448m4.138-3.448a9.014 9.014 0 0 1 0 9.424m-4.138-5.976a3.736 3.736 0 0 0-.88-1.388 3.737 3.737 0 0 0-1.388-.88m2.268 2.268a3.765 3.765 0 0 1 0 2.528m-2.268-4.796a3.765 3.765 0 0 0-2.528 0m4.796 4.796c-.181.506-.475.982-.88 1.388a3.736 3.736 0 0 1-1.388.88m2.268-2.268 4.138 3.448m0 0a9.027 9.027 0 0 1-1.306 1.652c-.51.51-1.064.944-1.652 1.306m0 0-3.448-4.138m3.448 4.138a9.014 9.014 0 0 1-9.424 0m5.976-4.138a3.765 3.765 0 0 1-2.528 0m0 0a3.736 3.736 0 0 1-1.388-.88 3.737 3.737 0 0 1-.88-1.388m2.268 2.268L7.288 19.67m0 0a9.024 9.024 0 0 1-1.652-1.306 9.027 9.027 0 0 1-1.306-1.652m0 0 4.138-3.448M4.33 16.712a9.014 9.014 0 0 1 0-9.424m4.138 5.976a3.765 3.765 0 0 1 0-2.528m0 0c.181-.506.475-.982.88-1.388a3.736 3.736 0 0 1 1.388-.88m-2.268 2.268L4.33 7.288m6.406 1.18L7.288 4.33m0 0a9.024 9.024 0 0 1 1.652-1.306A9.025 9.025 0 0 1 10.59 1.72" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Still need help?</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Our support team is standing by. Send us an email and we'll get back to you within one business day — usually much faster.
          </p>
          <a
            href="mailto:support@adguru.app"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary via-sky-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-primary/30 transition-all hover:shadow-lg hover:shadow-primary/40"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
            Contact Support
          </a>
          <p className="mt-3 text-xs text-muted-foreground">support@adguru.app · Typically replies within 1 business day</p>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-border/60 bg-background/70">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <p>© 2026 Ad Guru. All rights reserved.</p>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link to="/" className="transition-colors hover:text-foreground">Home</Link>
            <Link to="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="transition-colors hover:text-foreground">Terms</Link>
            <Link to="/support" className="transition-colors hover:text-foreground">Support</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
