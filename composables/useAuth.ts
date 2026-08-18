export type ThemePreference = 'day' | 'night' | 'auto'
export type ResolvedTheme = 'day' | 'night'

export type AuthUser = {
  id: string
  username: string
  email: string
  role: 'admin' | 'user'
  activeNodeId: string | null
  theme: ThemePreference
}

function errorMessage(e: any, fallback: string) {
  return (
    e?.data?.statusMessage ||
    e?.statusMessage ||
    e?.data?.message ||
    e?.message ||
    fallback
  )
}

/** Forward cookies during SSR; plain $fetch on client. */
function apiFetch<T>(url: string, opts: Parameters<typeof $fetch>[1] = {}) {
  const requestFetch = import.meta.server ? useRequestFetch() : $fetch
  return requestFetch<T>(url, {
    credentials: 'include',
    ...opts
  })
}

export function useAuth() {
  const user = useState<AuthUser | null>('auth-user', () => null)

  async function refresh() {
    const res = await apiFetch<{ user: AuthUser | null }>('/api/auth/me')
    user.value = res.user
    return res.user
  }

  async function login(username: string, password: string) {
    try {
      const res = await apiFetch<{ user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: { username, password }
      })
      user.value = res.user
      return res.user
    } catch (e: any) {
      throw new Error(errorMessage(e, 'Login failed'))
    }
  }

  async function register(payload: { username: string; email: string; password: string }) {
    try {
      const res = await apiFetch<{ user: AuthUser }>('/api/auth/register', {
        method: 'POST',
        body: payload
      })
      user.value = res.user
      return res.user
    } catch (e: any) {
      throw new Error(errorMessage(e, 'Registration failed'))
    }
  }

  async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' })
    user.value = null
  }

  return { user, refresh, login, register, logout }
}
