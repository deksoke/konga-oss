<script setup lang="ts">
import type { OAuthProviderId } from '~/types/settings'

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

const OAUTH_IDS = ['google', 'facebook', 'line', 'github', 'gitlab'] as const satisfies readonly OAuthProviderId[]

const emptyOAuthFlags = (): Record<OAuthProviderId, boolean> => ({
  google: false,
  facebook: false,
  line: false,
  github: false,
  gitlab: false
})

function oauthFlagsFrom(source: Record<string, unknown> | undefined, pick: (value: unknown) => boolean) {
  const next = emptyOAuthFlags()
  for (const id of OAUTH_IDS) {
    next[id] = pick(source?.[id])
  }
  return next
}

const oauthErrors: Record<string, string> = {
  not_configured: 'Social login is not configured.',
  already_linked: 'That social account is already linked to another user.',
  invalid_state: 'Linking expired. Try again.',
  exchange_failed: 'Could not complete linking.',
  denied: 'Linking was cancelled.',
  login_required: 'Sign in first to link a social account.'
}

const oauthNames: Record<OAuthProviderId, string> = {
  google: 'Google',
  facebook: 'Facebook',
  line: 'LINE',
  github: 'GitHub',
  gitlab: 'GitLab'
}

const TABS = [
  { id: 'account', label: 'Account' },
  { id: 'password', label: 'Change password' },
  { id: 'linked', label: 'Linked accounts' }
] as const

type ProfileTab = (typeof TABS)[number]['id']

const { user: authUser, refresh } = useAuth()
const route = useRoute()
const notify = useNotify()

const profile = ref<AppUser | null>(null)
const error = ref('')
const savingProfile = ref(false)
const savingPassword = ref(false)
const oauthLinked = reactive(emptyOAuthFlags())
const oauthEnabled = reactive(emptyOAuthFlags())
const oauthBusy = ref<OAuthProviderId | null>(null)
const oauthLoading = ref(false)

const tab = computed<ProfileTab>(() => {
  const q = String(route.query.tab || 'account')
  return TABS.some((item) => item.id === q) ? (q as ProfileTab) : 'account'
})

const readyOAuthIds = computed(() => OAUTH_IDS.filter((id) => oauthEnabled[id]))

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
    notify.success('Profile saved')
  } catch (e: any) {
    const msg = e?.data?.statusMessage || 'Failed to save profile'
    error.value = msg
    notify.error(msg)
  } finally {
    savingProfile.value = false
  }
}

async function changePassword() {
  if (!passwordForm.password || !passwordForm.current_password) {
    notify.error('Fill in all password fields')
    return
  }
  if (passwordForm.password !== passwordForm.password_confirmation) {
    notify.error('New passwords do not match')
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
    notify.success('Password changed')
  } catch (e: any) {
    notify.error(e?.data?.statusMessage || 'Failed to change password')
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
    Object.assign(
      oauthEnabled,
      oauthFlagsFrom(pub.data?.oauth_providers, (value) => Boolean((value as { enabled?: boolean } | undefined)?.enabled))
    )
  } catch {
    // keep previous provider flags
  }
  try {
    const accounts = await $fetch<{ linked: Record<string, boolean> }>('/api/auth/oauth/accounts')
    Object.assign(
      oauthLinked,
      oauthFlagsFrom(accounts.linked, (value) => Boolean(value))
    )
  } catch {
    // keep previous linked flags
  } finally {
    oauthLoading.value = false
  }
}

async function unlinkOAuth(id: OAuthProviderId) {
  oauthBusy.value = id
  try {
    await $fetch(`/api/auth/oauth/${id}`, { method: 'DELETE' })
    oauthLinked[id] = false
    notify.success(`${oauthNames[id]} unlinked`)
  } catch (e: any) {
    notify.error(e?.data?.statusMessage || `Failed to unlink ${oauthNames[id]}`)
  } finally {
    oauthBusy.value = null
  }
}

function applyOAuthQueryFeedback() {
  const code = route.query.oauth_error
  if (typeof code === 'string' && oauthErrors[code]) {
    error.value = oauthErrors[code]
    notify.error(oauthErrors[code])
  }
  if (route.query.oauth === 'linked') {
    notify.success('Social account linked')
  }
}

onMounted(() => {
  load()
  loadOAuth()
  applyOAuthQueryFeedback()
})

watch(
  () => authUser.value?.id,
  () => {
    load()
    loadOAuth()
  }
)
</script>

<template>
  <div class="profile-page">
    <div class="profile-header">
      <h1 class="page-title">My profile</h1>
      <p class="muted page-lead">Update your account details and password.</p>
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
        <ProfileAccountSection
          v-if="tab === 'account'"
          v-model:form="profileForm"
          :role-label="profile.admin ? 'Administrator' : 'User'"
          :status-label="profile.active ? 'Active' : 'Inactive'"
          :saving="savingProfile"
          @save="saveProfile"
        />
        <ProfilePasswordSection
          v-else-if="tab === 'password'"
          v-model:form="passwordForm"
          :saving="savingPassword"
          @save="changePassword"
        />
        <ProfileLinkedAccountsSection
          v-else-if="tab === 'linked'"
          :provider-ids="readyOAuthIds"
          :linked="oauthLinked"
          :loading="oauthLoading"
          :busy-id="oauthBusy"
          @unlink="unlinkOAuth"
        />
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

.page-title {
  margin: 0;
}

.page-lead {
  margin: 0.5rem 0 0;
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
