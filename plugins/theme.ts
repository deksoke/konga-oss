export default defineNuxtPlugin(() => {
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
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => {
      if (preference.value === 'auto') apply('auto')
    }
    mq.addEventListener('change', onChange)
  }
})
