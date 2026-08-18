<script setup lang="ts">
definePageMeta({ layout: 'default' })

type AppUser = {
  id: string
  username: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'user'
  admin: boolean
  active: boolean
  createdAt: string
  updatedAt: string
}

const { user: authUser, refresh } = useAuth()

const profile = ref<AppUser | null>(null)
const error = ref('')
const savingProfile = ref(false)
const savingPassword = ref(false)

const profileForm = reactive({
  username: '',
  firstName: '',
  lastName: '',
  email: ''
})

const passwordForm = reactive({
  current_password: '',
  password: '',
  password_confirmation: ''
})

async function load() {
  error.value = ''
  if (!authUser.value?.id) {
    error.value = 'Not signed in'
    return
  }
  try {
    const res = await $fetch<{ data: AppUser }>(`/api/users/${authUser.value.id}`)
    profile.value = res.data
    Object.assign(profileForm, {
      username: res.data.username,
      firstName: res.data.firstName || '',
      lastName: res.data.lastName || '',
      email: res.data.email
    })
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Failed to load profile'
    profile.value = null
  }
}

async function saveProfile() {
  if (!authUser.value?.id) return
  savingProfile.value = true
  error.value = ''
  try {
    const res = await $fetch<{ data: AppUser }>(`/api/users/${authUser.value.id}`, {
      method: 'PATCH',
      body: {
        username: profileForm.username.trim(),
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        email: profileForm.email.trim()
      }
    })
    profile.value = res.data
    await refresh()
    useNotify().success('Profile saved')
  } catch (e: any) {
    const msg = e?.data?.statusMessage || 'Failed to save profile'
    error.value = msg
    useNotify().error(msg)
  } finally {
    savingProfile.value = false
  }
}

async function changePassword() {
  if (!passwordForm.password || !passwordForm.current_password) {
    useNotify().error('Fill in all password fields')
    return
  }
  if (passwordForm.password !== passwordForm.password_confirmation) {
    useNotify().error('New passwords do not match')
    return
  }
  savingPassword.value = true
  try {
    await $fetch('/api/auth/password', {
      method: 'POST',
      body: { ...passwordForm }
    })
    Object.assign(passwordForm, {
      current_password: '',
      password: '',
      password_confirmation: ''
    })
    useNotify().success('Password changed')
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Failed to change password')
  } finally {
    savingPassword.value = false
  }
}

onMounted(load)
watch(() => authUser.value?.id, load)
</script>

<template>
  <div class="stack" style="max-width: 40rem">
    <div>
      <h1 style="margin: 0">My profile</h1>
      <p class="muted" style="margin: 0.5rem 0 0">Update your account details and password.</p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="profile">
      <form class="card stack" @submit.prevent="saveProfile">
        <h2 style="margin: 0; font-size: 1.1rem">Account</h2>
        <div>
          <label class="label">Username</label>
          <input v-model="profileForm.username" class="input" required minlength="3" autocomplete="username" />
        </div>
        <div class="row" style="gap: 0.75rem">
          <div style="flex: 1">
            <label class="label">First name</label>
            <input v-model="profileForm.firstName" class="input" autocomplete="given-name" />
          </div>
          <div style="flex: 1">
            <label class="label">Last name</label>
            <input v-model="profileForm.lastName" class="input" autocomplete="family-name" />
          </div>
        </div>
        <div>
          <label class="label">Email</label>
          <input v-model="profileForm.email" class="input" type="email" required autocomplete="email" />
        </div>
        <div class="muted" style="font-size: 0.9rem">
          Role: {{ profile.admin ? 'Administrator' : 'User' }}
          · Status: {{ profile.active ? 'Active' : 'Inactive' }}
        </div>
        <div>
          <button class="btn btn-primary" type="submit" :disabled="savingProfile">
            {{ savingProfile ? 'Saving…' : 'Save profile' }}
          </button>
        </div>
      </form>

      <form class="card stack" @submit.prevent="changePassword">
        <h2 style="margin: 0; font-size: 1.1rem">Change password</h2>
        <div>
          <label class="label">Current password</label>
          <input
            v-model="passwordForm.current_password"
            class="input"
            type="password"
            required
            autocomplete="current-password"
          />
        </div>
        <div>
          <label class="label">New password</label>
          <input
            v-model="passwordForm.password"
            class="input"
            type="password"
            required
            minlength="8"
            autocomplete="new-password"
          />
        </div>
        <div>
          <label class="label">Confirm new password</label>
          <input
            v-model="passwordForm.password_confirmation"
            class="input"
            type="password"
            required
            minlength="8"
            autocomplete="new-password"
          />
        </div>
        <div>
          <button class="btn btn-primary" type="submit" :disabled="savingPassword">
            {{ savingPassword ? 'Updating…' : 'Change password' }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>
