import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfirmProvider } from '@/components/ConfirmProvider'
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
import { LibraryPage } from '@/pages/LibraryPage'
import { HistoryPage } from '@/pages/HistoryPage'

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
    <ConfirmProvider>
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
          <Route path="library" element={<LibraryPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </ConfirmProvider>
  )
}

export default App
