import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Sparkles, CalendarDays, BarChart3, Megaphone } from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'

const BENEFITS = [
  { icon: Sparkles, text: 'AI-written posts in seconds' },
  { icon: CalendarDays, text: 'Schedule across every platform' },
  { icon: BarChart3, text: 'Track engagement & leads in one place' },
  { icon: Megaphone, text: 'Launch Meta ads without the complexity' },
]

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (authError) setError(authError.message)
    else navigate('/app')
  }

  const handleForgotPassword = async () => {
    setError('')
    setNotice('')
    const target = email.trim().toLowerCase()
    if (!target) {
      setError('Enter your email above first, then click "Forgot password?".')
      return
    }
    setResetting(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResetting(false)
    if (resetError) setError(resetError.message)
    else setNotice(`If an account exists for ${target}, a password reset link is on its way. Check your inbox.`)
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
        {/* Background layers */}
        <div className="alive-mesh absolute inset-0 opacity-90" />
        <div className="alive-grid-bg absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-blue-600/70 to-blue-700/60" />

        {/* Content */}
        <div className="relative flex h-full flex-col p-10">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <AppLogo variant="full" imgClassName="h-11 brightness-0 invert" />
          </Link>

          {/* Main copy */}
          <div className="mt-auto pb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Welcome back</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-white">
              Your content.<br />Your audience.<br />
              <span className="text-white/80">Amplified.</span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              Everything you need to create, schedule, and grow - all in one beautiful workspace.
            </p>

            {/* Benefit list */}
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

            {/* Social proof */}
            <div className="mt-8 flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">J</div>
              <div>
                <p className="text-xs leading-relaxed text-white/90">"Cut my content workflow from hours to minutes. Game changer."</p>
                <p className="mt-1 text-[11px] text-white/55">James K. · Digital agency owner</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-primary via-primary-600 to-primary-800 px-6 py-12">
        {/* Mobile logo */}
        <Link to="/" className="mb-8 flex items-center lg:hidden">
          <AppLogo variant="full" imgClassName="h-11 brightness-0 invert" />
        </Link>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-white">Sign in to Ad Guru</h1>
            <p className="mt-1.5 text-sm text-white/70">
              Don't have an account?{' '}
              <Link to="/signup" className="font-medium text-white underline hover:text-white/90">
                Start free
              </Link>
            </p>
          </div>

          {/* Google SSO */}
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2.5 border-white/30 bg-white/15 font-medium text-white shadow-sm backdrop-blur hover:bg-white/25 hover:text-white"
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
              <span className="w-full border-t border-white/25" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-transparent px-3 text-white/60">or continue with email</span>
            </div>
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-white/90">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 border-white/30 bg-white/15 text-white placeholder:text-white/40 backdrop-blur focus:border-white/60 focus:ring-white/30"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-white/90">Password</Label>
                <button
                  type="button"
                  className="text-xs text-white/60 hover:text-white disabled:opacity-60"
                  disabled={resetting}
                  onClick={() => void handleForgotPassword()}
                >
                  {resetting ? 'Sending…' : 'Forgot password?'}
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 border-white/30 bg-white/15 pr-10 text-white placeholder:text-white/40 backdrop-blur focus:border-white/60 focus:ring-white/30"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-red-300/40 bg-red-500/20 px-3 py-2 text-sm text-white">
                {error}
              </p>
            )}

            {notice && (
              <p className="rounded-lg border border-emerald-300/40 bg-emerald-500/20 px-3 py-2 text-sm text-white">
                {notice}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full bg-white text-sm font-semibold text-primary shadow-md hover:bg-white/90"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-white/50">
            By signing in you agree to our{' '}
            <Link to="/terms" className="text-white/70 underline hover:text-white">Terms</Link>
            {' '}and{' '}
            <Link to="/privacy" className="text-white/70 underline hover:text-white">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
