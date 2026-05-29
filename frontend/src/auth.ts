// auth.ts
// Session management via localStorage.

const AUTH_KEY = 'lg-auth'
const USER_KEY = 'lg-user'

export interface User {
  id:   string
  name: string
}

const VALID_USERS = [
  { id: 'LG2026', password: 'admin123', name: 'Plant Head'      },
  { id: 'LG2027', password: 'manager1', name: 'Product Manager' },
  { id: 'LG2028', password: 'employee', name: 'Line Employee'   },
]

export function signIn(
  employeeId: string,
  password:   string
): { success: boolean; user?: User; error?: string } {
  const user = VALID_USERS.find(
    u => u.id === employeeId && u.password === password
  )
  if (user) {
    const u: User = { id: user.id, name: user.name }
    localStorage.setItem(AUTH_KEY, 'true')
    localStorage.setItem(USER_KEY, JSON.stringify(u))
    return { success: true, user: u }
  }
  return { success: false, error: 'Invalid Employee ID or Password.' }
}

export function signOut(): void {
  localStorage.removeItem(AUTH_KEY)
  localStorage.removeItem(USER_KEY)
}

export function isAuthenticated(): boolean {
  return localStorage.getItem(AUTH_KEY) === 'true'
}

export function getCurrentUser(): User | null {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}