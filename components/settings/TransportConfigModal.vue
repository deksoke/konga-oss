<script setup lang="ts">
import type { MailgunSettings, SmtpSettings, Transport } from '~/types/settings'

defineProps<{
  transport: Transport
  error: string
  saving: boolean
  testingSmtp: boolean
}>()

const smtpDraft = defineModel<SmtpSettings | null>('smtpDraft', { required: true })
const mailgunDraft = defineModel<MailgunSettings | null>('mailgunDraft', { required: true })

const emit = defineEmits<{
  close: []
  save: []
  testSmtp: []
}>()
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-panel" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2 style="margin: 0; font-size: 1.1rem; text-transform: uppercase">
          Configure {{ transport.name }}
        </h2>
        <button class="banner-close" type="button" @click="emit('close')">×</button>
      </div>
      <div class="modal-body stack">
        <p v-if="error" class="error" style="margin: 0">{{ error }}</p>

        <template v-if="transport.name === 'smtp' && smtpDraft">
          <div>
            <label class="label">host</label>
            <input v-model="smtpDraft.host" class="input" placeholder="The SMTP host" />
          </div>
          <div>
            <label class="label">port</label>
            <input v-model="smtpDraft.port" class="input" placeholder="The SMTP port" />
          </div>
          <div>
            <label class="label">username</label>
            <input v-model="smtpDraft.auth.user" class="input" placeholder="The SMTP user username" />
          </div>
          <div>
            <label class="label">password</label>
            <input
              v-model="smtpDraft.auth.pass"
              class="input"
              type="password"
              placeholder="The SMTP user password"
              autocomplete="new-password"
            />
          </div>
          <div>
            <label class="label">secure</label>
            <label class="toggle">
              <input v-model="smtpDraft.secure" type="checkbox" />
              <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb" /></span>
              <span class="toggle-label">{{ smtpDraft.secure ? 'YES' : 'NO' }}</span>
            </label>
            <p class="help">Use secure connection</p>
          </div>
        </template>

        <template v-else-if="transport.name === 'mailgun' && mailgunDraft">
          <div>
            <label class="label">api_key</label>
            <input
              v-model="mailgunDraft.auth.api_key"
              class="input"
              type="password"
              placeholder="The API key that you got from www.mailgun.com/cp"
              autocomplete="new-password"
            />
          </div>
          <div>
            <label class="label">domain</label>
            <input
              v-model="mailgunDraft.auth.domain"
              class="input"
              placeholder="One of your domain names listed at your https://mailgun.com/app/domains"
            />
          </div>
        </template>

        <button
          class="btn btn-primary"
          type="button"
          style="width: 100%"
          :disabled="saving"
          @click="emit('save')"
        >
          {{ saving ? 'Saving…' : '✓ Submit changes' }}
        </button>
        <button
          v-if="transport.name === 'smtp' && smtpDraft"
          class="btn"
          type="button"
          style="width: 100%"
          :disabled="testingSmtp || saving"
          @click="emit('testSmtp')"
        >
          {{ testingSmtp ? 'Sending…' : 'Send test email' }}
        </button>
        <p v-if="transport.name === 'smtp'" class="help" style="margin: 0">
          Test uses the values above and sends to your admin account email. Make sure the default sender
          address in Settings is allowed by your SMTP provider.
        </p>
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
