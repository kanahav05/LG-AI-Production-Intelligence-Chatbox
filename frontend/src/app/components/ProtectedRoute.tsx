import { Navigate } from 'react-router-dom'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuth = localStorage.getItem('lg-auth') === 'true'
  if (!isAuth) return <Navigate to="/" replace />
  return <>{children}</>
}