function safeRedirectPath(value: unknown, fallback = '/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return fallback
  }
  return value
}

export default defineNuxtRouteMiddleware(async (to) => {
  const publicPaths = ['/login', '/register']
  const adminPaths = ['/users', '/snapshots', '/settings']
  const { user, refresh } = useAuth()
  const requestFetch = import.meta.server ? useRequestFetch() : $fetch

  if (!user.value) {
    try {
      await refresh()
    } catch {
      user.value = null
    }
  }

  useTheme().syncFromUser(user.value?.theme || 'auto')

  let needsBootstrap = false
  let signupEnabled = false
  try {
    const status = await requestFetch<{ needsBootstrap: boolean; signupEnabled?: boolean }>('/api/auth/status', {
      credentials: 'include'
    })
    needsBootstrap = status.needsBootstrap
    signupEnabled = Boolean(status.signupEnabled)
  } catch {
    needsBootstrap = to.path === '/register'
  }

  if (needsBootstrap && to.path !== '/register') {
    return navigateTo('/register')
  }

  if (!needsBootstrap && to.path === '/register' && !signupEnabled) {
    return navigateTo({
      path: '/login',
      query: to.query.redirect ? { redirect: String(to.query.redirect) } : undefined
    })
  }

  if (!user.value && !publicPaths.includes(to.path)) {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  }

  if (user.value && (to.path === '/login' || to.path === '/register')) {
    return navigateTo(safeRedirectPath(to.query.redirect, '/'))
  }

  if (
    user.value &&
    user.value.role !== 'admin' &&
    adminPaths.some((p) => to.path === p || to.path.startsWith(`${p}/`))
  ) {
    return navigateTo('/')
  }
})
