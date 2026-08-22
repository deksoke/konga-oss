<script setup lang="ts">
import type { OAuthProviderId, Settings } from '~/types/settings'

const props = defineProps<{
  settings: Settings
  draft: {
    id: OAuthProviderId
    clientId: string
    clientSecret: string
    issuerBaseUrl: string
  }
  oauthMeta: Record<OAuthProviderId, { name: string; help: string }>
  gitlabBasePlaceholder: string
  callbackUrl: string
  error: string
  saving: boolean
}>()

const emit = defineEmits<{
  close: []
  save: []
}>()
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-panel" style="width: min(440px, 100%)" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2 style="margin: 0; font-size: 1.1rem">Configure {{ oauthMeta[draft.id].name }}</h2>
        <button class="banner-close" type="button" @click="emit('close')">×</button>
      </div>
      <div class="modal-body stack">
        <p v-if="error" class="error" style="margin: 0">{{ error }}</p>
        <p class="help" style="margin: 0">{{ oauthMeta[draft.id].help }}</p>
        <div>
          <label class="label">Callback URL</label>
          <input class="input" :value="callbackUrl" readonly />
          <p class="help">Register this exact URL with {{ oauthMeta[draft.id].name }}.</p>
        </div>
        <div>
          <label class="label">Client ID</label>
          <input v-model="draft.clientId" class="input" autocomplete="off" />
        </div>
        <div v-if="draft.id === 'gitlab'">
          <label class="label">GitLab base URL</label>
          <input
            v-model="draft.issuerBaseUrl"
            class="input"
            :placeholder="gitlabBasePlaceholder"
            autocomplete="off"
          />
          <p class="help">Defaults to {{ gitlabBasePlaceholder }}. Use your instance URL for self-hosted GitLab.</p>
        </div>
        <div>
          <label class="label">Client secret</label>
          <input
            v-model="draft.clientSecret"
            class="input"
            type="password"
            autocomplete="new-password"
            :placeholder="
              props.settings.oauth_providers[draft.id].secretConfigured ? 'Leave blank to keep current secret' : ''
            "
          />
        </div>
        <button class="btn btn-primary" type="button" :disabled="saving" @click="emit('save')">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.help {
  margin: 0.35rem 0 0;
  color: var(--muted);
  font-size: 0.85rem;
  display: block;
}
</style>
