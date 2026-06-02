import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'

/**
 * Landing page for the password-recovery email link. Supabase (with
 * detectSessionInUrl) exchanges the recovery token in the URL for a temporary
 * session and fires a PASSWORD_RECOVERY auth event. We wait for that session,
 * then let the user set a new password via updateUser.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let active = true

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasSession(true)
        setReady(true)
      }
    })

    // Also check for an already-established session (token may have been
    // exchanged before this listener attached).
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      if (data.session) setHasSession(true)
      setReady(true)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setDone(true)
    setTimeout(() => navigate('/app'), 1800)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-blue-500 to-blue-600 text-sm font-bold text-white shadow-md shadow-primary/30">
            A
          </div>
          <span className="text-sm font-semibold">Ad Guru</span>
        </Link>

        {done ? (
          <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
            <h1 className="mt-4 text-xl font-bold tracking-tight">Password updated</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              You're all set. Redirecting you to your dashboard…
            </p>
          </div>
        ) : !ready ? (
          <div className="flex justify-center py-12">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : !hasSession ? (
          <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <ShieldCheck className="h-6 w-6 text-destructive" />
            </div>
            <h1 className="mt-4 text-xl font-bold tracking-tight">Link expired or invalid</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              This reset link is no longer valid. Request a new one from the sign-in page.
            </p>
            <Button className="mt-5 w-full" onClick={() => navigate('/login')}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <KeyRound className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Set a new password</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Choose a strong password you don't use elsewhere.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-sm font-medium">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
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

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  className="h-11"
                />
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
                {loading ? 'Updating…' : 'Update password'}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              <Link to="/login" className="underline hover:text-foreground">Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
