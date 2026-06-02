import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ScrollToTop } from '@/components/ScrollToTop'
import { ConfirmProvider } from '@/components/ConfirmProvider'
import { CreditProvider } from '@/contexts/CreditContext'
import { useAuth } from '@/hooks/useAuth'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { LandingPage } from '@/pages/LandingPage'
import { WorkspaceSetupPage } from '@/pages/WorkspaceSetupPage'
import { Layout } from '@/components/Layout'
import { DashboardPage } from '@/pages/DashboardPage'
import { PlannerPage } from '@/pages/PlannerPage'
import { ComposePage } from '@/pages/ComposePage'
import { AdsPage } from '@/pages/AdsPage'
import { AdDetailPage } from '@/pages/AdDetailPage'
import { AdHistoryPage } from '@/pages/AdHistoryPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { LibraryPage } from '@/pages/LibraryPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { AdminPanelPage } from '@/pages/admin/AdminPanelPage'
import { AdminRoute } from '@/components/admin/AdminRoute'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { TermsPage } from '@/pages/TermsPage'
import { SupportPage } from '@/pages/SupportPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'

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
    <ScrollToTop />
    <CreditProvider>
      <Routes>
        <Route path="/" element={profile ? <Navigate to="/app" /> : <LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={profile ? <Navigate to="/app" /> : <LoginPage />} />
        <Route path="/signup" element={profile ? <Navigate to="/app" /> : <SignupPage />} />
        <Route path="/workspace-setup" element={!profile ? <Navigate to="/login" /> : <WorkspaceSetupPage />} />
        <Route path="/app/*" element={!profile ? <Navigate to="/login" /> : <Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="planner" element={<PlannerPage />} />
          <Route path="compose" element={<ComposePage />} />
          <Route path="ads" element={<AdsPage />} />
          <Route path="ads/history" element={<AdHistoryPage />} />
          <Route path="ads/library/:creativeId" element={<AdDetailPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route
            path="admin"
            element={
              <AdminRoute>
                <AdminPanelPage />
              </AdminRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to={profile ? '/app' : '/'} />} />
      </Routes>
    </CreditProvider>
    </BrowserRouter>
    </ConfirmProvider>
  )
}

export default App
