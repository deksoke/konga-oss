<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { login } = useAuth()
const route = useRoute()
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

function redirectTarget() {
  const value = route.query.redirect
  if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) {
    return value
  }
  return '/'
}

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await login(username.value.trim(), password.value)
    const target = redirectTarget()
    if (import.meta.client) {
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
  </div>
</template>
