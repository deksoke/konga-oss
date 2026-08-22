<script setup lang="ts">
import facebookIcon from '~/assets/images/social-logins/facebook.png'
import githubIcon from '~/assets/images/social-logins/github.png'
import gitlabIcon from '~/assets/images/social-logins/gitlab.png'
import googleIcon from '~/assets/images/social-logins/google.png'
import lineIcon from '~/assets/images/social-logins/line.png'

definePageMeta({ layout: 'auth' })

const { login } = useAuth()
const route = useRoute()
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const oauthProviders = reactive({
  google: false,
  facebook: false,
  line: false,
  github: false,
  gitlab: false
})

const oauthMeta = {
  google: { name: 'Google', icon: googleIcon },
  facebook: { name: 'Facebook', icon: facebookIcon },
  line: { name: 'LINE', icon: lineIcon },
  github: { name: 'GitHub', icon: githubIcon },
  gitlab: { name: 'GitLab', icon: gitlabIcon }
} as const
const oauthIds = ['google', 'facebook', 'line', 'github', 'gitlab'] as const

const oauthErrors: Record<string, string> = {
  not_configured: 'Social login is not configured.',
  not_linked: 'This social account is not linked. Sign in with your password, then link it from your profile.',
  denied: 'Social sign-in was cancelled.',
  invalid_state: 'Social sign-in expired. Try again.',
  exchange_failed: 'Could not complete social sign-in.',
  inactive: 'This account is inactive.',
  login_required: 'Sign in with your password first to link a social account.',
  rate_limited: 'Too many attempts. Try again later.',
  already_linked: 'That social account is already linked to another user.'
}

function redirectTarget() {
  const value = route.query.redirect
  if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) {
    return value
  }
  return '/'
}

async function loadOAuth() {
  try {
    const res = await $fetch<{
      data: { oauth_providers?: Record<string, { enabled?: boolean }> }
    }>('/api/settings/public')
    const providers = res.data.oauth_providers || {}
    Object.assign(oauthProviders, {
      google: Boolean(providers.google?.enabled),
      facebook: Boolean(providers.facebook?.enabled),
      line: Boolean(providers.line?.enabled),
      github: Boolean(providers.github?.enabled),
      gitlab: Boolean(providers.gitlab?.enabled)
    })
  } catch {
    Object.assign(oauthProviders, {
      google: false,
      facebook: false,
      line: false,
      github: false,
      gitlab: false
    })
  }
}

const readyOAuthIds = computed(() => oauthIds.filter((id) => oauthProviders[id]))

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await login(username.value.trim(), password.value)
    const target = redirectTarget()
    if (typeof window !== 'undefined') {
      window.location.assign(target)
      return
    }
    await navigateTo(target)
  } catch (e: any) {
    error.value = e?.message || e?.data?.statusMessage || 'Login failed'
  } finally {
    loading.value = false
  }
}

onMounted(loadOAuth)
watch(
  () => route.query.oauth_error,
  (code: unknown) => {
    if (typeof code === 'string' && oauthErrors[code]) error.value = oauthErrors[code]
  },
  { immediate: true }
)
</script>

<template>
  <div class="card auth-card stack">
    <div class="auth-brand">
      <img src="/images/konga-logo.png" alt="Konga" class="auth-logo" width="220" height="60" />
      <p class="muted">Sign in to manage Kong Admin API</p>
      <p class="muted" style="font-size: 0.8rem; margin: 0.25rem 0 0">
        First install? Default admin credentials are printed once in the server / container logs.
      </p>
    </div>
    <form class="stack" @submit.prevent="onSubmit">
      <div>
        <label class="label">Username or email</label>
        <input
          v-model="username"
          class="input"
          name="username"
          autocomplete="username"
          autofocus
          required
        />
      </div>
      <div>
        <label class="label">Password</label>
        <input
          v-model="password"
          class="input"
          name="password"
          type="password"
          autocomplete="current-password"
          required
        />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn btn-primary" type="submit" :disabled="loading">
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
    <template v-if="readyOAuthIds.length">
      <p class="muted" style="text-align: center; margin: 0">or</p>
      <div class="stack">
        <a
          v-for="id in readyOAuthIds"
          :key="id"
          class="btn oauth-btn"
          :href="`/api/auth/oauth/${id}/start`"
        >
          <img :src="oauthMeta[id].icon" :alt="oauthMeta[id].name" class="oauth-icon" width="20" height="20" />
          Continue with {{ oauthMeta[id].name }}
        </a>
      </div>
    </template>
  </div>
</template>

<style scoped>
.oauth-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
}

.oauth-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  flex-shrink: 0;
}
</style>
