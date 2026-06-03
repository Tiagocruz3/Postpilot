import { Link } from 'react-router-dom'
import { AppLogo } from '@/components/AppLogo'

export function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky nav */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center">
            <AppLogo variant="full" imgClassName="h-8" />
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
          <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: June 1, 2026</p>
        </div>

        <div className="space-y-8 text-sm leading-7 text-muted-foreground">

          {/* 1. Acceptance */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Ad Guru ("the Service"), you agree to be bound by these Terms of Service
              ("Terms"). If you are using the Service on behalf of an organisation, you represent that you have
              the authority to bind that organisation to these Terms, and "you" refers to that organisation.
              If you do not agree to these Terms, do not use the Service.
            </p>
            <p className="mt-3">
              These Terms incorporate our{' '}
              <Link to="/privacy" className="text-foreground underline underline-offset-2 hover:opacity-80">
                Privacy Policy
              </Link>
              , which is also binding when you use the Service.
            </p>
          </section>

          {/* 2. Service Description */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">2. Description of Service</h2>
            <p>
              Ad Guru is an AI-powered social media command center that allows you to create posts, ad copy,
              AI-generated images and videos, manage scheduled publishing across multiple social platforms, and
              view performance analytics. Features include but are not limited to:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1">
              <li>AI-assisted caption and ad copy generation</li>
              <li>AI image and video creation</li>
              <li>Multi-platform post scheduling and publishing</li>
              <li>Social media ad campaign management</li>
              <li>Content library and inspiration tools</li>
              <li>Performance analytics and reporting</li>
            </ul>
            <p className="mt-3">
              We reserve the right to modify, suspend, or discontinue any feature of the Service at any time with
              reasonable notice where practicable.
            </p>
          </section>

          {/* 3. Account Responsibilities */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">3. Account Responsibilities</h2>
            <p className="mb-3">You are responsible for:</p>
            <ul className="list-inside list-disc space-y-2">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activity that occurs under your account</li>
              <li>Providing accurate and current account information</li>
              <li>Promptly notifying us at{' '}
                <a href="mailto:support@adguru.app" className="text-foreground underline underline-offset-2 hover:opacity-80">
                  support@adguru.app
                </a>{' '}
                if you suspect unauthorised access to your account
              </li>
              <li>Ensuring any team members you invite comply with these Terms</li>
            </ul>
            <p className="mt-3">
              You must be at least 13 years old (16 in the EU/UK) to create an account. Accounts created by
              automated means or bots are prohibited.
            </p>
          </section>

          {/* 4. Acceptable Use */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">4. Acceptable Use</h2>
            <p className="mb-3">You agree <span className="font-medium text-foreground">not</span> to use the Service to:</p>
            <ul className="list-inside list-disc space-y-2">
              <li>Send spam, bulk unsolicited messages, or engage in mass automated posting that violates platform policies</li>
              <li>Violate the terms of service, community guidelines, or advertising policies of any connected social platform (including Meta, TikTok, LinkedIn, and others)</li>
              <li>Create or distribute content that is illegal, defamatory, obscene, harassing, hateful, or violates third-party intellectual property rights</li>
              <li>Attempt to circumvent platform rate limits, access controls, or API restrictions</li>
              <li>Use the Service to run disinformation campaigns, coordinated inauthentic behaviour, or any form of platform manipulation</li>
              <li>Reverse-engineer, decompile, or attempt to extract source code from the Service</li>
              <li>Resell, sublicense, or commercially exploit the Service without our express written permission</li>
              <li>Use the Service in any way that could damage, disable, or impair its infrastructure</li>
            </ul>
            <p className="mt-3">
              Violation of this section may result in immediate suspension or termination of your account, with or
              without notice, and may be reported to relevant authorities or platform providers.
            </p>
          </section>

          {/* 5. AI-Generated Content */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">5. AI-Generated Content</h2>
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <p className="font-medium text-foreground">Important: You are responsible for what you publish.</p>
            </div>
            <p className="mt-3">
              Ad Guru provides AI tools to assist in content creation. You acknowledge that:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2">
              <li>AI-generated content may be inaccurate, incomplete, or inappropriate for your specific use case. Always review content before publishing.</li>
              <li>You are solely responsible for any content you publish through the Service, whether AI-assisted or not.</li>
              <li>AI-generated images and videos may have limitations and could occasionally produce unexpected results.</li>
              <li>You must ensure all published content complies with applicable laws, platform policies, and industry regulations, including advertising standards.</li>
              <li>You must not use AI generation features to produce content that infringes copyright, constitutes defamation, or violates any third-party rights.</li>
              <li>Ad Guru makes no warranty that AI-generated content is fit for commercial use or free from third-party IP claims.</li>
            </ul>
          </section>

          {/* 6. Subscription and Billing */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">6. Subscription and Billing</h2>
            <p className="mb-3">
              Ad Guru offers free and paid subscription plans. The following terms apply to paid subscriptions:
            </p>
            <ul className="list-inside list-disc space-y-2">
              <li><span className="font-medium text-foreground">Billing cycle:</span> Subscriptions are billed monthly or annually in advance, depending on the plan you select.</li>
              <li><span className="font-medium text-foreground">Automatic renewal:</span> Subscriptions automatically renew unless cancelled before the renewal date.</li>
              <li><span className="font-medium text-foreground">Price changes:</span> We will give you at least 30 days' notice of any price changes before they take effect.</li>
              <li><span className="font-medium text-foreground">Refunds:</span> We offer a 14-day refund for first-time subscribers. After that period, subscription fees are non-refundable except where required by applicable law.</li>
              <li><span className="font-medium text-foreground">AI credits:</span> Some plans include a monthly AI credit allocation. Unused credits do not roll over to the next billing period.</li>
              <li><span className="font-medium text-foreground">Cancellation:</span> You may cancel your subscription at any time through the account settings. You will retain access until the end of the current billing period.</li>
              <li><span className="font-medium text-foreground">Taxes:</span> Prices may be subject to applicable taxes (e.g. GST in Australia), which will be displayed at checkout.</li>
            </ul>
          </section>

          {/* 7. Intellectual Property */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">7. Intellectual Property and Ownership</h2>
            <p className="mb-3">
              <span className="font-medium text-foreground">Your content:</span> You retain all ownership rights to
              the content you create using Ad Guru (posts, captions, images, videos, ad copy). By using the Service,
              you grant Ad Guru a limited, non-exclusive, royalty-free licence to store, process, and transmit your
              content solely for the purpose of providing the Service to you.
            </p>
            <p className="mb-3">
              <span className="font-medium text-foreground">Our platform:</span> Ad Guru, including its software,
              design, trademarks, and all associated intellectual property, is owned by us or our licensors. You may
              not copy, modify, distribute, or create derivative works from any part of the Service without our express
              written consent.
            </p>
            <p>
              <span className="font-medium text-foreground">Feedback:</span> If you submit feedback or suggestions
              about the Service, you grant us the right to use that feedback without restriction or compensation to you.
            </p>
          </section>

          {/* 8. Limitation of Liability */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">8. Disclaimers and Limitation of Liability</h2>
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <p className="mb-2">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS
                OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
                PURPOSE, OR NON-INFRINGEMENT.
              </p>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, AD GURU SHALL NOT BE LIABLE FOR ANY INDIRECT,
                INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA,
                OR BUSINESS OPPORTUNITIES, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE, EVEN IF WE HAVE
                BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
              </p>
            </div>
            <p className="mt-3">
              Our total aggregate liability to you for any claims arising under or related to these Terms shall not
              exceed the greater of (a) the total fees paid by you to Ad Guru in the 12 months immediately preceding
              the claim, or (b) AUD $100.
            </p>
            <p className="mt-3">
              Nothing in these Terms limits liability for death or personal injury caused by negligence, fraud, or any
              other liability that cannot be excluded by law.
            </p>
          </section>

          {/* 9. Indemnification */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">9. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Ad Guru and its officers, directors, employees, and
              agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable
              legal fees) arising out of or in any way connected with your use of the Service, your content, your
              violation of these Terms, or your violation of any third-party rights.
            </p>
          </section>

          {/* 10. Governing Law */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">10. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of Queensland, Australia, without
              regard to conflict-of-law principles. Any disputes arising under these Terms shall be subject to the
              exclusive jurisdiction of the courts of Queensland, Australia, except where mandatory consumer
              protection laws in your jurisdiction provide otherwise.
            </p>
            <p className="mt-3">
              Nothing in these Terms limits your rights under the Australian Consumer Law (ACL), including any
              non-excludable consumer guarantees that apply to our Service.
            </p>
          </section>

          {/* 11. Termination */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">11. Termination</h2>
            <p>
              We may suspend or terminate your account and access to the Service at any time, with or without cause,
              upon reasonable notice. If we terminate for breach of these Terms, we are not obliged to provide a
              refund. You may terminate your account at any time through the account settings. Upon termination, your
              right to use the Service ceases immediately, and your data will be handled in accordance with our{' '}
              <Link to="/privacy" className="text-foreground underline underline-offset-2 hover:opacity-80">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          {/* 12. Changes */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">12. Changes to These Terms</h2>
            <p>
              We may modify these Terms at any time. If we make material changes, we will notify you by email or via
              a prominent in-app notice at least 14 days before the changes take effect. Your continued use of the
              Service after the effective date constitutes acceptance of the updated Terms. If you do not agree to the
              new Terms, you must stop using the Service and may cancel your subscription.
            </p>
          </section>

          {/* 13. Contact */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">13. Contact Us</h2>
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <p className="mb-1 font-medium text-foreground">Ad Guru Legal</p>
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
