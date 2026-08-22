<script setup lang="ts">
import type { SettingsIntegration } from '~/types/settings'

defineProps<{
  item: SettingsIntegration
  error: string
  saving: boolean
}>()

const webhookDraft = defineModel<string>('webhookDraft', { required: true })

const emit = defineEmits<{
  close: []
  save: []
}>()
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-panel" style="width: min(440px, 100%)" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2 style="margin: 0; font-size: 1.1rem; text-transform: uppercase">Configure {{ item.name }}</h2>
        <button class="banner-close" type="button" @click="emit('close')">×</button>
      </div>
      <div class="modal-body stack">
        <p v-if="error" class="error" style="margin: 0">{{ error }}</p>
        <div>
          <label class="label">
            {{ item.name }} Webhook URL <span class="error">*</span>
          </label>
          <input
            v-model="webhookDraft"
            class="input"
            type="url"
            :placeholder="
              item.id === 'discord'
                ? 'https://discord.com/api/webhooks/...'
                : 'https://hooks.slack.com/services/...'
            "
            autocomplete="off"
          />
          <p class="help">
            <template v-if="item.id === 'discord'">
              Create a webhook in your Discord channel settings (Integrations → Webhooks), then paste the URL here.
            </template>
            <template v-else>
              Create an Incoming Webhook in your Slack workspace, then paste the URL here.
            </template>
          </p>
        </div>
        <button
          class="btn btn-primary"
          type="button"
          style="width: 100%"
          :disabled="saving"
          @click="emit('save')"
        >
          {{ saving ? 'Saving…' : '✓ Submit changes' }}
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
