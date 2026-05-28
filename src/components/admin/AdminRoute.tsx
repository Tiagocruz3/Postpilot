import { Navigate } from 'react-router-dom'
import { useCredits } from '@/contexts/CreditContext'

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { balance, loading } = useCredits()

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!balance.isAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
