import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Profile } from '@/types'
import { isDemoMode, demoUser, demoProfile } from '@/lib/demo'
import { loadUserPreferences, profileToUserPreferences, saveUserPreferences } from '@/lib/user-preferences'

export function useAuth() {
  const [user, setUser] = useState<User | null>(isDemoMode ? demoUser : null)
  const [profile, setProfile] = useState<Profile | null>(isDemoMode ? demoProfile : null)
  const [loading, setLoading] = useState(!isDemoMode)

  useEffect(() => {
    if (isDemoMode) {
      return
    }

    let active = true

    async function loadProfile(nextUser: User | null) {
      if (!active) {
        return
      }

      setUser(nextUser)

      if (!nextUser) {
        setProfile(null)
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', nextUser.id)
        .single()

      if (!active) {
        return
      }

      if (data) {
        const nextProfile = data as Profile
        const nextPreferences = profileToUserPreferences(nextProfile, loadUserPreferences())
        saveUserPreferences(nextPreferences)
        setProfile(nextProfile)
        await supabase.rpc('accept_my_workspace_invites')
      } else {
        setProfile(null)
      }

      setLoading(false)
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadProfile(session?.user ?? null)
    })

    void supabase.auth.getUser().then(({ data: { user: currentUser } }) => loadProfile(currentUser))

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return { user, profile, loading }
}
