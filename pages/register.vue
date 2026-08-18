<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { register } = useAuth()
const username = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await register({
      username: username.value.trim(),
      email: email.value.trim(),
      password: password.value
    })
    if (import.meta.client) {
      window.location.assign('/')
      return
    }
    await navigateTo('/')
  } catch (e: any) {
    error.value =
      e?.message ||
      e?.statusMessage ||
      e?.data?.statusMessage ||
      e?.data?.message ||
      'Registration failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="card auth-card stack">
    <div class="auth-brand">
      <img src="/images/konga-logo.png" alt="Konga" class="auth-logo" width="220" height="60" />
      <h1>Welcome</h1>
      <p class="muted">Create the first administrator account</p>
    </div>
    <!-- method=post + button type=button prevents password leaking into the URL if JS fails -->
    <form class="stack" method="post" action="#" @submit.prevent="onSubmit">
      <div>
        <label class="label">Username</label>
        <input v-model="username" class="input" name="username" autocomplete="username" required minlength="3" />
      </div>
      <div>
        <label class="label">Email</label>
        <input v-model="email" class="input" type="email" name="email" autocomplete="email" required />
      </div>
      <div>
        <label class="label">Password (min 8 characters)</label>
        <input
          v-model="password"
          class="input"
          type="password"
          name="password"
          autocomplete="new-password"
          required
          minlength="8"
        />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn btn-primary" type="button" :disabled="loading" @click="onSubmit">
        {{ loading ? 'Creating…' : 'Create admin' }}
      </button>
    </form>
    <p class="muted" style="font-size: 0.85rem; margin: 0">
      Already created?
      <NuxtLink to="/login">Sign in</NuxtLink>
    </p>
  </div>
</template>
