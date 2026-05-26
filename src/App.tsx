import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { WorkspaceSetupPage } from '@/pages/WorkspaceSetupPage'
import { Layout } from '@/components/Layout'
import { DashboardPage } from '@/pages/DashboardPage'
import { PlannerPage } from '@/pages/PlannerPage'
import { ComposePage } from '@/pages/ComposePage'
import { AdsPage } from '@/pages/AdsPage'
import { SettingsPage } from '@/pages/SettingsPage'

function App() {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={profile ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/signup" element={profile ? <Navigate to="/" /> : <SignupPage />} />
        <Route path="/workspace-setup" element={!profile ? <Navigate to="/login" /> : <WorkspaceSetupPage />} />
        <Route path="/*" element={!profile ? <Navigate to="/login" /> : <Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="planner" element={<PlannerPage />} />
          <Route path="compose" element={<ComposePage />} />
          <Route path="ads" element={<AdsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
