<script setup lang="ts">
import type { OAuthProviderId } from '~/types/settings'
import facebookIcon from '~/assets/images/social-logins/facebook.png'
import githubIcon from '~/assets/images/social-logins/github.png'
import gitlabIcon from '~/assets/images/social-logins/gitlab.png'
import googleIcon from '~/assets/images/social-logins/google.png'
import lineIcon from '~/assets/images/social-logins/line.png'

const oauthMeta = {
  google: { name: 'Google', icon: googleIcon },
  facebook: { name: 'Facebook', icon: facebookIcon },
  line: { name: 'LINE', icon: lineIcon },
  github: { name: 'GitHub', icon: githubIcon },
  gitlab: { name: 'GitLab', icon: gitlabIcon }
} as const

defineProps<{
  providerIds: OAuthProviderId[]
  linked: Record<OAuthProviderId, boolean>
  loading: boolean
  busyId: string | null
}>()

const emit = defineEmits<{
  unlink: [id: OAuthProviderId]
}>()
</script>

<template>
  <div class="stack">
    <h2 class="section-title">Linked accounts</h2>
    <p class="muted intro">
      Connect a social login to this local user. You can still sign in with your password.
    </p>
    <p v-if="loading" class="muted intro">Loading social accounts…</p>
    <template v-else-if="providerIds.length">
      <div v-for="id in providerIds" :key="id" class="row provider-row">
        <span class="oauth-name">
          <img :src="oauthMeta[id].icon" :alt="oauthMeta[id].name" class="oauth-icon" width="24" height="24" />
          {{ oauthMeta[id].name }} — {{ linked[id] ? 'Linked' : 'Not linked' }}
        </span>
        <a v-if="!linked[id]" class="btn" :href="`/api/auth/oauth/${id}/start?intent=link`">
          Link {{ oauthMeta[id].name }}
        </a>
        <button v-else class="btn" type="button" :disabled="busyId === id" @click="emit('unlink', id)">
          {{ busyId === id ? 'Unlinking…' : 'Unlink' }}
        </button>
      </div>
    </template>
    <p v-else class="muted intro">
      No social login providers are ready to use. Enable a provider in Settings and save its client ID and secret.
    </p>
  </div>
</template>

<style scoped>
.section-title {
  margin: 0;
  font-size: 1.1rem;
}

.intro {
  margin: 0;
}

.provider-row {
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
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
</style>
