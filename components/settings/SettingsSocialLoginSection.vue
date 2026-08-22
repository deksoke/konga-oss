<script setup lang="ts">
import OAuthConfigModal from '~/components/settings/OAuthConfigModal.vue'
import type { OAuthProviderId, Settings } from '~/types/settings'
import facebookIcon from '~/assets/images/social-logins/facebook.png'
import githubIcon from '~/assets/images/social-logins/github.png'
import gitlabIcon from '~/assets/images/social-logins/gitlab.png'
import googleIcon from '~/assets/images/social-logins/google.png'
import lineIcon from '~/assets/images/social-logins/line.png'

const props = defineProps<{
  settings: Settings
}>()

const emit = defineEmits<{
  updated: [data: Settings]
}>()

const oauthOrigin = ref('')
const oauthDraft = ref<{
  id: OAuthProviderId
  clientId: string
  clientSecret: string
  issuerBaseUrl: string
} | null>(null)
const oauthError = ref('')
const oauthSaving = ref(false)

const oauthMeta = {
  google: {
    name: 'Google',
    icon: googleIcon,
    help: 'Create an OAuth client in Google Cloud Console (Web application).'
  },
  facebook: {
    name: 'Facebook',
    icon: facebookIcon,
    help: 'Create an app in Facebook Developers and add Facebook Login.'
  },
  line: { name: 'LINE', icon: lineIcon, help: 'Create a LINE Login channel in LINE Developers.' },
  github: { name: 'GitHub', icon: githubIcon, help: 'Create an OAuth App in GitHub Developer settings.' },
  gitlab: {
    name: 'GitLab',
    icon: gitlabIcon,
    help: 'Create an application in GitLab (gitlab.com or a self-hosted instance).'
  }
} as const

const oauthIds = ['google', 'facebook', 'line', 'github', 'gitlab'] as const
const GITLAB_BASE_PLACEHOLDER = 'https://gitlab.com'

function oauthCallbackUrl(id: OAuthProviderId) {
  const origin = oauthOrigin.value || (import.meta.client ? window.location.origin : '')
  return `${origin}/api/auth/oauth/${id}/callback`
}

function copyCallback(id: OAuthProviderId) {
  const url = oauthCallbackUrl(id)
  if (!url || !navigator.clipboard) return
  navigator.clipboard.writeText(url).then(
    () => useNotify().success('Callback URL copied'),
    () => useNotify().error('Could not copy URL')
  )
}

function openOAuthConfig(id: OAuthProviderId) {
  const row = props.settings.oauth_providers[id]
  oauthError.value = ''
  oauthDraft.value = {
    id,
    clientId: row.clientId || '',
    clientSecret: '',
    issuerBaseUrl: id === 'gitlab' ? row.issuerBaseUrl || GITLAB_BASE_PLACEHOLDER : ''
  }
}

function closeOAuthConfig() {
  oauthDraft.value = null
  oauthError.value = ''
}

async function saveOAuth() {
  if (!oauthDraft.value) return
  const id = oauthDraft.value.id
  const clientId = oauthDraft.value.clientId.trim()
  const clientSecret = oauthDraft.value.clientSecret.trim()
  const current = props.settings.oauth_providers[id]
  if (!clientId) {
    oauthError.value = 'Client ID is required'
    return
  }
  if (!current.secretConfigured && !clientSecret) {
    oauthError.value = 'Client secret is required'
    return
  }
  oauthSaving.value = true
  try {
    const res = await $fetch<{ data: Settings }>('/api/settings', {
      method: 'PUT',
      body: {
        oauth_providers: {
          [id]: {
            enabled: current.enabled,
            clientId,
            ...(clientSecret ? { clientSecret } : {}),
            ...(id === 'gitlab' ? { issuerBaseUrl: oauthDraft.value.issuerBaseUrl.trim() } : {})
          }
        }
      }
    })
    emit('updated', res.data)
    closeOAuthConfig()
    useNotify().success(`${oauthMeta[id].name} settings saved`)
  } catch (e: any) {
    oauthError.value = e?.data?.statusMessage || 'Failed to save'
  } finally {
    oauthSaving.value = false
  }
}

async function toggleOAuth(id: OAuthProviderId) {
  const row = props.settings.oauth_providers[id]
  if (!row.enabled && (!row.clientId || !row.secretConfigured)) {
    openOAuthConfig(id)
    useNotify().error('Configure client ID and secret before enabling')
    return
  }
  const res = await $fetch<{ data: Settings }>('/api/settings', {
    method: 'PUT',
    body: {
      oauth_providers: {
        [id]: { enabled: !row.enabled, clientId: row.clientId }
      }
    }
  })
  emit('updated', res.data)
}

onMounted(() => {
  oauthOrigin.value = window.location.origin
})
</script>

<template>
  <section class="card stack">
    <h2 class="section-title">Social login</h2>
    <p class="help">
      Link Google, Facebook, or LINE for users who already have a local account. Callback URLs use this browser
      origin and must be registered with each provider.
    </p>
    <div class="grid-3">
      <div
        v-for="id in oauthIds"
        :key="id"
        class="integration"
        :class="{ active: settings.oauth_providers[id].enabled }"
      >
        <div class="integration-top">
          <span class="integration-name">
            <img :src="oauthMeta[id].icon" :alt="oauthMeta[id].name" class="oauth-icon" width="24" height="24" />
            <strong>{{ oauthMeta[id].name }}</strong>
          </span>
          <button class="gear-btn" type="button" title="Configure" @click="openOAuthConfig(id)">⚙</button>
        </div>
        <p class="help" style="margin: 0 0 0.75rem">{{ oauthMeta[id].help }}</p>
        <p class="help" style="margin: 0 0 0.5rem; word-break: break-all">
          {{ oauthCallbackUrl(id) }}
        </p>
        <div class="row" style="gap: 0.5rem; flex-wrap: wrap">
          <button class="btn" type="button" @click="copyCallback(id)">Copy callback URL</button>
          <button class="btn" type="button" @click="toggleOAuth(id)">
            {{ settings.oauth_providers[id].enabled ? 'Disable' : 'Enable' }}
          </button>
        </div>
        <p v-if="settings.oauth_providers[id].secretConfigured" class="ok-inline" style="margin: 0.5rem 0 0">
          Secret saved
        </p>
      </div>
    </div>
  </section>

  <OAuthConfigModal
    v-if="oauthDraft"
    :settings="settings"
    :draft="oauthDraft"
    :oauth-meta="oauthMeta"
    :gitlab-base-placeholder="GITLAB_BASE_PLACEHOLDER"
    :callback-url="oauthCallbackUrl(oauthDraft.id)"
    :error="oauthError"
    :saving="oauthSaving"
    @close="closeOAuthConfig"
    @save="saveOAuth"
  />
</template>

<style scoped>
.section-title {
  margin: 0;
  font-size: 1.15rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border, rgba(127, 127, 127, 0.25));
}
.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}
.help {
  margin: 0.35rem 0 0;
  color: var(--muted);
  font-size: 0.85rem;
  display: block;
}
.integration {
  border: 1px solid var(--border, rgba(127, 127, 127, 0.3));
  border-radius: 10px;
  padding: 0.85rem;
  text-align: left;
  background: transparent;
  color: var(--text);
}
.integration.active {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}
.integration-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.integration-name {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
.oauth-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
  flex-shrink: 0;
}
.ok-inline {
  color: var(--ok);
  font-weight: 600;
}
.gear-btn {
  border: 0;
  background: transparent;
  cursor: pointer;
  color: var(--muted);
  font-size: 1.1rem;
  padding: 0.15rem 0.35rem;
  border-radius: 6px;
}
.gear-btn:hover {
  color: var(--text);
  background: var(--surface-2, rgba(127, 127, 127, 0.12));
}
@media (max-width: 800px) {
  .grid-3 {
    grid-template-columns: 1fr;
  }
}
</style>
