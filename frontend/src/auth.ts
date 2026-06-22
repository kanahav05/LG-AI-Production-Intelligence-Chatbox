// auth.ts
// JWT based authentication flow
// Stores JWT token and user info in localStorage

export const AUTH_TOKEN_KEY = 'lg-auth-token';
const USER_KEY = 'lg-user';

export interface User {
  id: string;
  name: string;
  role: string;
}

export async function signIn(employeeId: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const response = await fetch('http://localhost:8000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: employeeId, password }),
    });
    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.detail ?? 'Invalid credentials' };
    }
    const data = await response.json();
    const token = data.access_token;
    // Decode token payload (base64) to extract user details (optional client-side verification)
    const payload = JSON.parse(atob(token.split('.')[1]));
    const user: User = { id: payload.user_id, name: payload.name, role: payload.role };
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return { success: true, user };
  } catch (e) {
    return { success: false, error: 'Network error' };
  }
}

export function signOut(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function hasValidSession(): boolean {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiredAt = payload.exp * 1000;
    if (Date.now() > expiredAt) {
      signOut();
      return false;
    }
    return true;
  } catch {
    signOut();
    return false;
  }
}

export function isAuthenticated(): boolean {
  return hasValidSession();
}

export function getCurrentUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}