// ProtectedRoute.tsx
// Guards all routes behind JWT authentication.
// Redirects to sign in if no valid token exists.

import { Navigate } from 'react-router-dom'
import { isAuthenticated } from '../../auth'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}