// ProtectedRoute.tsx
// Guards all routes behind JWT authentication.
// Redirects to sign in if no valid token exists.

import { Navigate } from 'react-router-dom'
import { AUTH_TOKEN_KEY } from '../../auth'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)

  if (!token) {
    return <Navigate to="/" replace />
  }

  // Check token expiry without making a network call
  try {
    const payload    = JSON.parse(atob(token.split('.')[1]))
    const expiredAt  = payload.exp * 1000  // convert to ms
    if (Date.now() > expiredAt) {
      localStorage.removeItem(AUTH_TOKEN_KEY)
      localStorage.removeItem('lg-user')
      return <Navigate to="/" replace />
    }
  } catch {
    // Malformed token — clear and redirect
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem('lg-user')
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}