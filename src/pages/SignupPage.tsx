import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, CheckCircle2, Sparkles, CalendarDays, BarChart3, Megaphone } from 'lucide-react'

const BENEFITS = [
  { icon: Sparkles, text: 'AI-written posts in seconds' },
  { icon: CalendarDays, text: 'Schedule across every platform' },
  { icon: BarChart3, text: 'Track engagement & leads in one place' },
  { icon: Megaphone, text: 'Launch Meta ads without the complexity' },
]

export function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/app`,
      },
    })
    setLoading(false)
    if (authError) setError(authError.message)
    else setMessage('Check your email for a confirmation link.')
  }

  const handleGoogleLogin = async () => {
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/app` },
    })
    if (authError) setError(authError.message)
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Left brand panel ── */}
      <div className="relative hidden w-[46%] flex-col overflow-hidden lg:flex">
        <div className="alive-mesh absolute inset-0 opacity-90" />
        <div className="alive-grid-bg absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-blue-600/70 to-blue-700/60" />

        <div className="relative flex h-full flex-col p-10">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-sm font-bold text-white shadow-lg backdrop-blur">
              A
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white/30 bg-emerald-400" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white">Ad Guru</div>
              <div className="text-[11px] text-white/70">AI social command center</div>
            </div>
          </Link>

          <div className="mt-auto pb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Free to start</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-white">
              One workspace.<br />Every platform.<br />
              <span className="text-white/80">Infinite reach.</span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              Join thousands of creators and businesses publishing smarter with AI-powered content tools.
            </p>

            <ul className="mt-7 space-y-3">
              {BENEFITS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-sm text-white/85">{text}</span>
                </li>
              ))}
            </ul>

            {/* Trust signals */}
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                { value: '5,200+', label: 'Posts published' },
                { value: '120k+', label: 'AI generations' },
                { value: '4.9 ★', label: 'Avg rating' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-white/20 bg-white/10 p-3 text-center backdrop-blur">
                  <p className="text-base font-bold text-white">{stat.value}</p>
                  <p className="mt-0.5 text-[10px] text-white/60">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-blue-500 to-blue-600 text-sm font-bold text-white shadow-md shadow-primary/30">
            A
          </div>
          <span className="text-sm font-semibold">Ad Guru</span>
        </Link>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Create your free account</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          {message ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
              <p className="font-semibold text-foreground">Check your inbox</p>
              <p className="mt-1 text-sm text-muted-foreground">{message}</p>
              <button
                type="button"
                className="mt-4 text-sm font-medium text-primary hover:underline"
                onClick={() => navigate('/login')}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              {/* Google SSO */}
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2.5 border-border/70 bg-background font-medium shadow-sm hover:bg-accent"
                onClick={handleGoogleLogin}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/60" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-3 text-muted-foreground">or sign up with email</span>
                </div>
              </div>

              {/* Email form */}
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-sm font-medium">Your name</Label>
                  <Input
                    id="name"
                    placeholder="Jane Smith"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="8+ characters"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full bg-gradient-to-r from-primary via-blue-500 to-blue-600 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/35"
                >
                  {loading ? 'Creating account...' : 'Create free account'}
                </Button>
              </form>

              <p className="mt-5 text-center text-xs text-muted-foreground">
                By signing up you agree to our{' '}
                <Link to="/terms" className="underline hover:text-foreground">Terms</Link>
                {' '}and{' '}
                <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
