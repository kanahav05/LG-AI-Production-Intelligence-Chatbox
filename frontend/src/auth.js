// auth.js
// Session management via localStorage.

const AUTH_KEY = "lg-auth";
const USER_KEY = "lg-user";

// Valid credentials for demo
const VALID_USERS = [
  { id: "LG2026", password: "admin123", name: "Plant Head" },
  { id: "LG2027", password: "manager1", name: "Product Manager" },
  { id: "LG2028", password: "employee", name: "Line Employee" },
];

export function signIn(employeeId, password) {
  const user = VALID_USERS.find(
    u => u.id === employeeId && u.password === password
  );
  if (user) {
    localStorage.setItem(AUTH_KEY, "true");
    localStorage.setItem(USER_KEY, JSON.stringify({ id: user.id, name: user.name }));
    return { success: true, user };
  }
  return { success: false, error: "Invalid Employee ID or Password" };
}

export function signOut() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return localStorage.getItem(AUTH_KEY) === "true";
}

export function getCurrentUser() {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
}