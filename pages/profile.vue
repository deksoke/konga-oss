<script setup lang="ts">
import facebookIcon from '~/assets/images/social-logins/facebook.png'
import githubIcon from '~/assets/images/social-logins/github.png'
import gitlabIcon from '~/assets/images/social-logins/gitlab.png'
import googleIcon from '~/assets/images/social-logins/google.png'
import lineIcon from '~/assets/images/social-logins/line.png'

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
const oauthLinked = reactive({ google: false, facebook: false, line: false, github: false, gitlab: false })
const oauthBusy = ref<string | null>(null)
const oauthEnabled = reactive({ google: false, facebook: false, line: false, github: false, gitlab: false })
const oauthLoading = ref(false)

const oauthErrors: Record<string, string> = {
  not_configured: 'Social login is not configured.',
  already_linked: 'That social account is already linked to another user.',
  invalid_state: 'Linking expired. Try again.',
  exchange_failed: 'Could not complete linking.',
  denied: 'Linking was cancelled.',
  login_required: 'Sign in first to link a social account.'
}

const oauthMeta = {
  google: { name: 'Google', icon: googleIcon },
  facebook: { name: 'Facebook', icon: facebookIcon },
  line: { name: 'LINE', icon: lineIcon },
  github: { name: 'GitHub', icon: githubIcon },
  gitlab: { name: 'GitLab', icon: gitlabIcon }
} as const
const oauthIds = ['google', 'facebook', 'line', 'github', 'gitlab'] as const

const TABS = [
  { id: 'account', label: 'Account' },
  { id: 'password', label: 'Change password' },
  { id: 'linked', label: 'Linked accounts' }
] as const

type ProfileTab = (typeof TABS)[number]['id']

const route = useRoute()

const tab = computed<ProfileTab>(() => {
  const q = String(route.query.tab || 'account')
  return TABS.some((item) => item.id === q) ? (q as ProfileTab) : 'account'
})

const readyOAuthIds = computed(() => oauthIds.filter((id) => oauthEnabled[id]))

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

async function loadOAuth() {
  oauthLoading.value = true
  try {
    const pub = await $fetch<{
      data: { oauth_providers?: Record<string, { enabled?: boolean }> }
    }>('/api/settings/public')
    const providers = pub.data?.oauth_providers || {}
    Object.assign(oauthEnabled, {
      google: Boolean(providers.google?.enabled),
      facebook: Boolean(providers.facebook?.enabled),
      line: Boolean(providers.line?.enabled),
      github: Boolean(providers.github?.enabled),
      gitlab: Boolean(providers.gitlab?.enabled)
    })
  } catch {
    // keep previous provider flags
  }
  try {
    const accounts = await $fetch<{ linked: Record<string, boolean> }>('/api/auth/oauth/accounts')
    Object.assign(oauthLinked, {
      google: Boolean(accounts.linked?.google),
      facebook: Boolean(accounts.linked?.facebook),
      line: Boolean(accounts.linked?.line),
      github: Boolean(accounts.linked?.github),
      gitlab: Boolean(accounts.linked?.gitlab)
    })
  } catch {
    // keep previous linked flags
  } finally {
    oauthLoading.value = false
  }
}

async function unlinkOAuth(id: (typeof oauthIds)[number]) {
  oauthBusy.value = id
  try {
    await $fetch(`/api/auth/oauth/${id}`, { method: 'DELETE' })
    oauthLinked[id] = false
    useNotify().success(`${oauthMeta[id].name} unlinked`)
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || `Failed to unlink ${oauthMeta[id].name}`)
  } finally {
    oauthBusy.value = null
  }
}

onMounted(() => {
  load()
  loadOAuth()
  const code = route.query.oauth_error
  if (typeof code === 'string' && oauthErrors[code]) {
    error.value = oauthErrors[code]
    useNotify().error(oauthErrors[code])
  }
  if (route.query.oauth === 'linked') {
    useNotify().success('Social account linked')
  }
})
watch(() => authUser.value?.id, () => {
  load()
  loadOAuth()
})
</script>

<template>
  <div class="profile-page">
    <div class="profile-header">
      <h1 style="margin: 0">My profile</h1>
      <p class="muted" style="margin: 0.5rem 0 0">Update your account details and password.</p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="profile" class="profile-shell">
      <nav class="profile-nav" aria-label="Profile sections">
        <NuxtLink
          v-for="item in TABS"
          :key="item.id"
          class="profile-nav-link"
          :class="{ active: tab === item.id }"
          :to="{ path: '/profile', query: { tab: item.id } }"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="profile-pane stack">
        <form v-if="tab === 'account'" class="stack" @submit.prevent="saveProfile">
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

        <form v-else-if="tab === 'password'" class="stack" @submit.prevent="changePassword">
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

        <div v-else-if="tab === 'linked'" class="stack">
          <h2 style="margin: 0; font-size: 1.1rem">Linked accounts</h2>
          <p class="muted" style="margin: 0">
            Connect a social login to this local user. You can still sign in with your password.
          </p>
          <p v-if="oauthLoading" class="muted" style="margin: 0">Loading social accounts…</p>
          <template v-else-if="readyOAuthIds.length">
            <div
              v-for="id in readyOAuthIds"
              :key="id"
              class="row"
              style="justify-content: space-between; align-items: center; gap: 0.75rem"
            >
              <span class="oauth-name">
                <img :src="oauthMeta[id].icon" :alt="oauthMeta[id].name" class="oauth-icon" width="24" height="24" />
                {{ oauthMeta[id].name }} — {{ oauthLinked[id] ? 'Linked' : 'Not linked' }}
              </span>
              <a v-if="!oauthLinked[id]" class="btn" :href="`/api/auth/oauth/${id}/start?intent=link`">
                Link {{ oauthMeta[id].name }}
              </a>
              <button
                v-else
                class="btn"
                type="button"
                :disabled="oauthBusy === id"
                @click="unlinkOAuth(id)"
              >
                {{ oauthBusy === id ? 'Unlinking…' : 'Unlink' }}
              </button>
            </div>
          </template>
          <p v-else class="muted" style="margin: 0">No social login providers are enabled.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  min-width: 0;
}

.profile-header {
  margin-bottom: 1.25rem;
}

.profile-shell {
  display: grid;
  grid-template-columns: 15rem minmax(0, 1fr);
  gap: 0;
  align-items: start;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card-bg);
  overflow: hidden;
}

.profile-nav {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.75rem 0;
  border-right: 1px solid var(--border);
  background: var(--panel-nav-bg);
  min-height: 24rem;
}

.profile-nav-link {
  position: relative;
  display: block;
  padding: 0.55rem 1rem 0.55rem 1.15rem;
  color: var(--text);
  text-decoration: none;
  font-size: 0.92rem;
}

.profile-nav-link:hover {
  background: var(--hover-tint);
}

.profile-nav-link.active {
  font-weight: 650;
  background: var(--hover-tint);
}

.profile-nav-link.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.35rem;
  bottom: 0.35rem;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--accent);
}

.profile-pane {
  padding: 1.25rem 1.5rem 1.5rem;
  min-width: 0;
}

.oauth-name {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
}

.oauth-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
  flex-shrink: 0;
}

@media (max-width: 800px) {
  .profile-shell {
    grid-template-columns: 1fr;
  }

  .profile-nav {
    flex-direction: row;
    flex-wrap: wrap;
    min-height: 0;
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding: 0.5rem;
    gap: 0.25rem;
  }

  .profile-nav-link {
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
  }

  .profile-nav-link.active::before {
    display: none;
  }
}
</style>
