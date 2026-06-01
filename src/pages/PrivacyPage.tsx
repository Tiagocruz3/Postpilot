import { Link } from 'react-router-dom'

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky nav */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4">
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

      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: June 1, 2026</p>
        </div>

        <div className="space-y-8 text-sm leading-7 text-muted-foreground">

          {/* Introduction */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">1. Introduction</h2>
            <p>
              Ad Guru ("we", "us", or "our") is committed to protecting your personal information and your right to
              privacy. This Privacy Policy describes how we collect, use, disclose, and safeguard your information when
              you use our AI-powered social media management platform at{' '}
              <span className="text-foreground">adguru.app</span> and any related services (collectively, the
              "Service"). Please read this policy carefully. If you disagree with its terms, please discontinue use of
              the Service.
            </p>
          </section>

          {/* Data We Collect */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">2. Information We Collect</h2>
            <p className="mb-3">We collect information you provide directly to us, information generated as you use the Service, and limited information from third-party platforms you choose to connect.</p>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Account Information</h3>
                <p>
                  When you create an account, we collect your name, email address, and password (stored as a secure
                  hash). If you sign up via a third-party OAuth provider (e.g. Google), we receive the profile
                  information that provider shares with us.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Usage Data</h3>
                <p>
                  We automatically collect information about how you interact with the Service, including pages visited,
                  features used, content created, posts scheduled, and time spent. This data helps us improve the
                  product and power AI recommendations tailored to you.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Social Platform Tokens</h3>
                <p>
                  When you connect a social media account (e.g. Facebook, Instagram, TikTok, LinkedIn), we receive and
                  store OAuth access tokens that allow Ad Guru to post on your behalf and retrieve analytics. These
                  tokens are stored encrypted at rest using AES-256 encryption. We never store your social media
                  passwords.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Content You Create</h3>
                <p>
                  We store the posts, captions, images, videos, ad copy, and scheduling data you create inside Ad Guru
                  so we can provide the Service. AI-generated content is processed through our AI providers and is not
                  used to train third-party models without your consent.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Payment Information</h3>
                <p>
                  If you subscribe to a paid plan, your payment details (credit card number, billing address) are
                  collected and processed directly by our payment processor. We do not store full card details on our
                  servers.
                </p>
              </div>
            </div>
          </section>

          {/* How We Use It */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">3. How We Use Your Information</h2>
            <ul className="list-inside list-disc space-y-2">
              <li>To provide, operate, and maintain the Service</li>
              <li>To power AI features including caption generation, image creation, and ad copy suggestions</li>
              <li>To schedule and publish content to your connected social media accounts</li>
              <li>To send transactional emails (account confirmations, billing receipts, scheduled-post notifications)</li>
              <li>To analyse product usage and improve features</li>
              <li>To detect and prevent fraud, abuse, or security incidents</li>
              <li>To comply with legal obligations</li>
            </ul>
            <p className="mt-3">
              We do not sell your personal information to third parties. We do not use your content to train our AI
              models or third-party AI models unless you explicitly opt in.
            </p>
          </section>

          {/* Third Parties */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">4. Third-Party Services</h2>
            <p className="mb-3">
              We use the following third-party services to operate Ad Guru. Each has its own privacy policy governing
              how they handle data:
            </p>
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium text-foreground">Provider</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">Supabase</td>
                    <td className="px-4 py-3">Database, authentication, and file storage</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">Meta / Facebook API</td>
                    <td className="px-4 py-3">Publishing content to Facebook and Instagram pages</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">OpenRouter</td>
                    <td className="px-4 py-3">AI language model routing for caption and copy generation</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">fal.ai</td>
                    <td className="px-4 py-3">AI image and video generation</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-foreground">Payment Processor</td>
                    <td className="px-4 py-3">Subscription billing and payment processing</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">5. Data Retention and Deletion</h2>
            <p className="mb-3">
              We retain your account data and content for as long as your account is active or as needed to provide the
              Service. If you close your account:
            </p>
            <ul className="list-inside list-disc space-y-2">
              <li>Your profile and content are soft-deleted immediately and permanently purged within 30 days.</li>
              <li>Social platform tokens are revoked and deleted immediately upon account closure or disconnection.</li>
              <li>Billing records are retained for 7 years as required by Australian tax law.</li>
              <li>Anonymised, aggregated analytics data may be retained indefinitely.</li>
            </ul>
            <p className="mt-3">
              You may request deletion of your data at any time by emailing{' '}
              <a
                href="mailto:support@adguru.app"
                className="text-foreground underline underline-offset-2 hover:opacity-80"
              >
                support@adguru.app
              </a>
              . We will action your request within 30 days.
            </p>
          </section>

          {/* User Rights */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">6. Your Rights (GDPR / CCPA)</h2>
            <p className="mb-3">
              Depending on your location, you may have the following rights regarding your personal data:
            </p>
            <ul className="list-inside list-disc space-y-2">
              <li><span className="font-medium text-foreground">Access:</span> Request a copy of the personal data we hold about you.</li>
              <li><span className="font-medium text-foreground">Correction:</span> Request that we correct inaccurate or incomplete data.</li>
              <li><span className="font-medium text-foreground">Deletion:</span> Request erasure of your personal data ("right to be forgotten").</li>
              <li><span className="font-medium text-foreground">Portability:</span> Request your data in a machine-readable format.</li>
              <li><span className="font-medium text-foreground">Restriction:</span> Request that we restrict processing of your data in certain circumstances.</li>
              <li><span className="font-medium text-foreground">Objection:</span> Object to processing based on legitimate interests.</li>
              <li><span className="font-medium text-foreground">Opt-out of sale (CCPA):</span> We do not sell your data, but you may contact us to confirm.</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{' '}
              <a
                href="mailto:support@adguru.app"
                className="text-foreground underline underline-offset-2 hover:opacity-80"
              >
                support@adguru.app
              </a>
              . We will respond within 30 days.
            </p>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">7. Cookies and Tracking</h2>
            <p className="mb-3">
              We use cookies and similar tracking technologies to operate and improve the Service:
            </p>
            <ul className="list-inside list-disc space-y-2">
              <li><span className="font-medium text-foreground">Essential cookies:</span> Required for authentication and session management. Cannot be disabled.</li>
              <li><span className="font-medium text-foreground">Analytics cookies:</span> Help us understand how users interact with the Service. You may opt out via your browser settings.</li>
              <li><span className="font-medium text-foreground">Preference cookies:</span> Remember your settings such as theme and language.</li>
            </ul>
            <p className="mt-3">
              You can control cookies through your browser settings. Disabling essential cookies may prevent the Service
              from functioning correctly.
            </p>
          </section>

          {/* Security */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">8. Security</h2>
            <p>
              We implement industry-standard security measures including TLS encryption in transit, AES-256 encryption
              at rest for sensitive tokens, and regular security audits. However, no method of transmission over the
              internet is 100% secure. We encourage you to use a strong, unique password and to enable two-factor
              authentication where available.
            </p>
          </section>

          {/* Children */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">9. Children's Privacy</h2>
            <p>
              The Service is not directed at children under the age of 13 (or 16 in the EU/UK). We do not knowingly
              collect personal information from children. If we become aware that a child has provided us with personal
              data, we will delete it promptly.
            </p>
          </section>

          {/* Changes */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. If we make material changes, we will notify you by
              email or by posting a prominent notice within the Service at least 14 days before the changes take effect.
              Your continued use of the Service after the effective date constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">11. Contact Us</h2>
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <p className="mb-1 font-medium text-foreground">Ad Guru Privacy Team</p>
              <p>
                Email:{' '}
                <a
                  href="mailto:support@adguru.app"
                  className="text-foreground underline underline-offset-2 hover:opacity-80"
                >
                  support@adguru.app
                </a>
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-border/60 bg-background/70">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
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
