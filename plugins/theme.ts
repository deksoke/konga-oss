import { msUntilNextThemeBoundary } from '~/utils/themeFromLocalHour'

export default defineNuxtPlugin((nuxtApp) => {
  const { user } = useAuth()
  const { preference, resolved, apply, syncFromUser } = useTheme()

  syncFromUser(user.value?.theme || 'auto')

  useHead({
    htmlAttrs: {
      'data-theme': resolved
    }
  })

  watch(
    () => user.value?.theme,
    (theme) => {
      syncFromUser(theme || 'auto')
    }
  )

  if (import.meta.client) {
    let timer: ReturnType<typeof setTimeout> | undefined

    function scheduleNext() {
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => {
        if (preference.value === 'auto') apply('auto')
        scheduleNext()
      }, msUntilNextThemeBoundary(new Date()))
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && preference.value === 'auto') {
        apply('auto')
      }
    }

    scheduleNext()
    document.addEventListener('visibilitychange', onVisibilityChange)

    nuxtApp.hook('app:beforeUnmount', () => {
      if (timer !== undefined) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    })
  }
})
