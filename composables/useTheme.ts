import type { ThemePreference, ResolvedTheme } from './useAuth'

function systemTheme(): ResolvedTheme {
  if (import.meta.client && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'day'
  }
  return 'night'
}

function normalizePreference(value: unknown): ThemePreference {
  if (value === 'day' || value === 'night' || value === 'auto') return value
  return 'auto'
}

export function useTheme() {
  const preference = useState<ThemePreference>('theme-preference', () => 'auto')
  const resolved = useState<ResolvedTheme>('theme-resolved', () => 'night')

  function resolve(pref: ThemePreference): ResolvedTheme {
    if (pref === 'day' || pref === 'night') return pref
    return systemTheme()
  }

  function apply(pref: ThemePreference = preference.value) {
    const next = normalizePreference(pref)
    preference.value = next
    resolved.value = resolve(next)
    if (import.meta.client) {
      document.documentElement.setAttribute('data-theme', resolved.value)
    }
  }

  async function setPreference(pref: ThemePreference) {
    apply(pref)
    const { user } = useAuth()
    if (!user.value) return
    try {
      const res = await $fetch<{ user: { theme: ThemePreference } }>('/api/auth/theme', {
        method: 'PATCH',
        body: { theme: pref },
        credentials: 'include'
      })
      user.value = { ...user.value, theme: res.user.theme }
    } catch (e: any) {
      useNotify().error(e?.data?.statusMessage || 'Failed to save theme')
    }
  }

  function syncFromUser(theme?: ThemePreference | null) {
    apply(normalizePreference(theme))
  }

  return {
    preference,
    resolved,
    setPreference,
    apply,
    syncFromUser
  }
}
