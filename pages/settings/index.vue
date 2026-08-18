<script setup lang="ts">
import slackLogo from '~/assets/images/integrations/slack-logo.svg'

definePageMeta({ layout: 'default' })

type SmtpSettings = {
  host: string
  port: string
  auth: { user: string; pass: string }
  secure: boolean
}

type MailgunSettings = {
  auth: { api_key: string; domain: string }
}

type Transport = {
  name: 'smtp' | 'sendmail' | 'mailgun'
  description: string
  settings: SmtpSettings | MailgunSettings | { sendmail: boolean }
}

type Settings = {
  signup_enable: boolean
  signup_require_activation: boolean
  info_polling_interval: number
  baseUrl: string
  email_default_sender_name: string
  email_default_sender: string
  email_notifications: boolean
  default_transport: string | null
  email_transports: Transport[]
  notify_when: Record<string, { title: string; description: string; active: boolean }>
  integrations: Array<{
    id: string
    name: string
    image?: string
    config: {
      enabled: boolean
      fields: Array<{ id: string; name: string; type: string; required?: boolean; value: string }>
      slack_webhook_url?: string
      discord_webhook_url?: string
    }
  }>
  user_permissions: Record<string, { create: boolean; read: boolean; update: boolean; delete: boolean }>
}

const settings = ref<Settings | null>(null)
const error = ref('')
const saving = ref(false)
const notifyTab = ref<'email' | 'integrations'>('email')
const configuring = ref<Settings['integrations'][number] | null>(null)
const webhookDraft = ref('')
const integrationError = ref('')
const testingIntegration = ref<string | null>(null)
const configuringTransport = ref<Transport | null>(null)
const smtpDraft = ref<SmtpSettings | null>(null)
const mailgunDraft = ref<MailgunSettings | null>(null)
const transportError = ref('')
const testingSmtp = ref(false)

function webhookFieldId(item: Settings['integrations'][number]) {
  if (item.id === 'discord') return 'discord_webhook_url'
  return 'slack_webhook_url'
}

function webhookValue(item: Settings['integrations'][number]) {
  const fieldId = webhookFieldId(item)
  const fromField = item.config.fields?.find((f) => f.id === fieldId)?.value
  return String((item.config as Record<string, unknown>)[fieldId] || fromField || '')
}

function integrationConfigured(item: Settings['integrations'][number]) {
  return Boolean(webhookValue(item).trim())
}

function integrationHelp(item: Settings['integrations'][number]) {
  if (item.id === 'discord') {
    return 'Send notifications to Discord using Incoming Webhooks.'
  }
  return 'Send notifications to Slack using Incoming Webhooks.'
}

async function load() {
  error.value = ''
  try {
    const res = await $fetch<{ data: Settings }>('/api/settings')
    settings.value = res.data
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Failed to load settings'
  }
}

async function save(partial?: Partial<Settings>) {
  if (!settings.value) return false
  saving.value = true
  try {
    const body = partial ? { ...settings.value, ...partial } : settings.value
    // Coerce polling interval so empty inputs don't fail Zod
    if (typeof body.info_polling_interval !== 'number' || Number.isNaN(body.info_polling_interval)) {
      body.info_polling_interval = 5000
    }
    const res = await $fetch<{ data: Settings }>('/api/settings', {
      method: 'PUT',
      body
    })
    settings.value = res.data
    useNotify().success('Settings saved')
    return true
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Save failed')
    return false
  } finally {
    saving.value = false
  }
}

function setDefaultTransport(name: string) {
  if (!settings.value) return
  settings.value.default_transport =
    settings.value.default_transport === name ? null : name
  settings.value.email_notifications = Boolean(settings.value.default_transport)
  save()
}

function closeTransportModal() {
  configuringTransport.value = null
  smtpDraft.value = null
  mailgunDraft.value = null
  transportError.value = ''
}

function openTransportConfig(t: Transport, event: Event) {
  event.stopPropagation()
  if (t.name === 'sendmail') return
  configuringTransport.value = t
  transportError.value = ''
  if (t.name === 'smtp') {
    const s = (t.settings || {}) as Partial<SmtpSettings>
    smtpDraft.value = {
      host: s.host || '',
      port: s.port != null ? String(s.port) : '',
      auth: { user: s.auth?.user || '', pass: s.auth?.pass || '' },
      secure: Boolean(s.secure)
    }
    mailgunDraft.value = null
  } else {
    const s = (t.settings || {}) as Partial<MailgunSettings>
    mailgunDraft.value = {
      auth: { api_key: s.auth?.api_key || '', domain: s.auth?.domain || '' }
    }
    smtpDraft.value = null
  }
}

async function submitTransport() {
  if (!settings.value || !configuringTransport.value) return
  const name = configuringTransport.value.name
  const idx = settings.value.email_transports.findIndex((t) => t.name === name)
  if (idx < 0) return

  transportError.value = ''
  let nextSettings: Transport['settings'] | null = null

  if (name === 'smtp' && smtpDraft.value) {
    const draft = smtpDraft.value
    if (!draft.host.trim()) {
      transportError.value = 'SMTP host is required'
      return
    }
    if (!String(draft.port).trim()) {
      transportError.value = 'SMTP port is required'
      return
    }
    nextSettings = {
      host: draft.host.trim(),
      port: String(draft.port).trim(),
      auth: { user: draft.auth.user.trim(), pass: draft.auth.pass },
      secure: Boolean(draft.secure)
    }
  } else if (name === 'mailgun' && mailgunDraft.value) {
    const draft = mailgunDraft.value
    if (!draft.auth.api_key.trim()) {
      transportError.value = 'Mailgun API key is required'
      return
    }
    if (!draft.auth.domain.trim()) {
      transportError.value = 'Mailgun domain is required'
      return
    }
    nextSettings = {
      auth: {
        api_key: draft.auth.api_key.trim(),
        domain: draft.auth.domain.trim()
      }
    }
  }

  if (!nextSettings) return

  const nextTransports = settings.value.email_transports.map((t, i) =>
    i === idx ? { ...t, settings: nextSettings! } : t
  )
  settings.value.email_transports = nextTransports

  const ok = await save({ email_transports: nextTransports })
  if (ok) closeTransportModal()
  else transportError.value = 'Failed to save transport settings'
}

async function testSmtp() {
  if (!smtpDraft.value) return
  const draft = smtpDraft.value
  transportError.value = ''
  if (!draft.host.trim()) {
    transportError.value = 'SMTP host is required'
    return
  }
  if (!String(draft.port).trim()) {
    transportError.value = 'SMTP port is required'
    return
  }

  testingSmtp.value = true
  try {
    const res = await $fetch<{ ok: boolean; to: string }>('/api/settings/email-transports/smtp/test', {
      method: 'POST',
      body: {
        host: draft.host.trim(),
        port: String(draft.port).trim(),
        secure: Boolean(draft.secure),
        auth: { user: draft.auth.user.trim(), pass: draft.auth.pass }
      }
    })
    useNotify().success(`Test email sent to ${res.to}`)
  } catch (e: any) {
    const msg = e?.data?.statusMessage || 'SMTP test failed'
    transportError.value = msg
    useNotify().error(msg)
  } finally {
    testingSmtp.value = false
  }
}

function openIntegrationConfig(item: Settings['integrations'][number]) {
  configuring.value = item
  integrationError.value = ''
  webhookDraft.value = webhookValue(item)
}

function closeIntegrationConfig() {
  configuring.value = null
  webhookDraft.value = ''
  integrationError.value = ''
}

async function saveIntegration() {
  if (!settings.value || !configuring.value) return
  const item = configuring.value
  const fieldId = webhookFieldId(item)
  const url = webhookDraft.value.trim()
  if (!url) {
    integrationError.value = `${item.name} Webhook URL is required`
    return
  }
  if (item.id === 'discord') {
    if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//i.test(url)) {
      integrationError.value = 'URL must start with https://discord.com/api/webhooks/'
      return
    }
  } else if (!/^https:\/\/hooks\.slack\.com\//i.test(url)) {
    integrationError.value = 'URL must start with https://hooks.slack.com/'
    return
  }

  const nextIntegrations = settings.value.integrations.map((row) => {
    if (row.id !== item.id) return row
    return {
      ...row,
      config: {
        ...row.config,
        enabled: row.config.enabled,
        [fieldId]: url,
        fields: (row.config.fields || []).map((field) =>
          field.id === fieldId ? { ...field, value: url } : field
        )
      }
    }
  })
  settings.value.integrations = nextIntegrations
  const ok = await save({ integrations: nextIntegrations })
  if (ok) closeIntegrationConfig()
  else integrationError.value = `Failed to save ${item.name} settings`
}

async function testIntegration(item: Settings['integrations'][number]) {
  testingIntegration.value = item.id
  try {
    await $fetch(`/api/settings/integrations/${item.id}/test`, { method: 'POST' })
    useNotify().success(`Test message sent to ${item.name}`)
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || `${item.name} test failed`)
  } finally {
    testingIntegration.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="stack" style="max-width: 56rem">
    <div>
      <h1 style="margin: 0">Settings</h1>
      <p class="muted" style="margin: 0.5rem 0 0">Application-wide Konga configuration.</p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <form v-if="settings" class="stack" @submit.prevent="save()">
      <section class="card stack">
        <h2 class="section-title">General settings</h2>
        <div class="grid-2">
          <div>
            <label class="label">Dashboard refresh interval</label>
            <input v-model.number="settings.info_polling_interval" class="input" type="number" min="0" />
            <p class="help">Milliseconds. Set to 0 to disable polling.</p>
          </div>
          <div>
            <label class="label">Base URL</label>
            <input v-model="settings.baseUrl" class="input" placeholder="ex. http://my-konga.io" />
            <p class="help">Used for generating links. Leave blank to use the server address.</p>
          </div>
        </div>
      </section>

      <section class="card stack">
        <h2 class="section-title">Sign up restrictions</h2>
        <label class="row check-row">
          <input v-model="settings.signup_enable" type="checkbox" @change="save()" />
          <span>
            Allow users to sign up.
            <span class="help">If enabled, users will be allowed to sign up.</span>
          </span>
        </label>
        <label class="row check-row">
          <input v-model="settings.signup_require_activation" type="checkbox" @change="save()" />
          <span>
            Send activation email.
            <span class="help">If disabled, users activate automatically.</span>
          </span>
        </label>
      </section>

      <section class="card stack">
        <h2 class="section-title">Notifications</h2>
        <div class="row" style="gap: 0.35rem">
          <button
            class="tab-btn"
            type="button"
            :class="{ active: notifyTab === 'email' }"
            @click="notifyTab = 'email'"
          >
            Email
          </button>
          <button
            class="tab-btn"
            type="button"
            :class="{ active: notifyTab === 'integrations' }"
            @click="notifyTab = 'integrations'"
          >
            3rd-party integrations
          </button>
        </div>

        <template v-if="notifyTab === 'email'">
          <p class="help">Setup Email notifications.</p>
          <div class="grid-2">
            <div>
              <label class="label">Default sender name</label>
              <input v-model="settings.email_default_sender_name" class="input" required />
            </div>
            <div>
              <label class="label">Default sender address</label>
              <input v-model="settings.email_default_sender" class="input" type="email" required />
            </div>
          </div>

          <h3 style="margin: 0; font-size: 0.95rem">Transports</h3>
          <p class="help">
            Configure email transports and select the one to use. You can disable email notifications by disabling all
            transports.
          </p>
          <div class="grid-3">
            <div
              v-for="t in settings.email_transports"
              :key="t.name"
              class="transport"
              :class="{ active: settings.default_transport === t.name }"
            >
              <div class="transport-head">
                <button class="transport-select" type="button" @click="setDefaultTransport(t.name)">
                  <span class="check" aria-hidden="true">{{ settings.default_transport === t.name ? '☑' : '☐' }}</span>
                  <strong>{{ t.name.toUpperCase() }}</strong>
                </button>
                <button
                  v-if="t.name !== 'sendmail'"
                  class="gear-btn"
                  type="button"
                  title="Configure"
                  @click="openTransportConfig(t, $event)"
                >
                  ⚙
                </button>
              </div>
              <p class="help" style="margin: 0.5rem 0 0">{{ t.description }}</p>
            </div>
          </div>
        </template>

        <template v-else>
          <p class="help">Integrate Konga with 3rd party applications.</p>
          <div class="grid-3">
            <div
              v-for="item in settings.integrations"
              :key="item.id"
              class="integration"
              :class="{ active: item.config.enabled }"
            >
              <div class="integration-top">
                <strong>{{ item.name }}</strong>
                <label class="toggle" :title="item.config.enabled ? 'Enabled' : 'Disabled'">
                  <input v-model="item.config.enabled" type="checkbox" @change="save()" />
                  <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb" /></span>
                </label>
              </div>
              <div class="integration-logo" aria-hidden="true">
                <img
                  v-if="item.id === 'slack'"
                  class="integration-icon"
                  :src="slackLogo"
                  alt=""
                  width="72"
                  height="72"
                />
                <!-- Discord mark -->
                <svg v-else-if="item.id === 'discord'" viewBox="0 0 120 120" width="72" height="72">
                  <rect width="120" height="120" rx="24" fill="#5865F2" />
                  <path
                    fill="#fff"
                    d="M85.5 36.2a62 62 0 0 0-15.3-4.7c-.7 1.2-1.4 2.8-1.9 4.1a57 57 0 0 0-16.6 0c-.5-1.3-1.2-2.9-1.9-4.1a62 62 0 0 0-15.3 4.7C22.6 51.1 19.7 65.6 21.2 79.9c6.6 4.9 13 7.9 19.2 9.8 1.5-2.1 2.9-4.3 4.1-6.6-2.2-0.8-4.4-1.9-6.4-3.1.5-.4 1.1-.8 1.6-1.2 12.7 5.9 26.4 5.9 38.9 0 .5.4 1.1.8 1.6 1.2-2 1.2-4.2 2.3-6.4 3.1 1.2 2.3 2.5 4.5 4.1 6.6 6.2-1.9 12.6-4.9 19.2-9.8 1.8-16.6-3.1-30.9-12.6-43.7zM49.5 68.6c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 3.9-2.9 7.1-6.4 7.1zm21 0c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 3.9-2.9 7.1-6.4 7.1z"
                  />
                </svg>
                <svg v-else viewBox="0 0 120 120" width="72" height="72">
                  <rect width="120" height="120" rx="24" fill="#334155" />
                </svg>
              </div>
              <p class="help" style="margin: 0.75rem 0">
                {{ integrationHelp(item) }}
                <span v-if="integrationConfigured(item)" class="ok-inline"> · Webhook saved</span>
              </p>
              <button
                class="btn btn-primary"
                type="button"
                style="width: 100%"
                @click="openIntegrationConfig(item)"
              >
                Configure
              </button>
              <button
                class="btn"
                type="button"
                style="width: 100%; margin-top: 0.4rem"
                :disabled="
                  testingIntegration === item.id || !item.config.enabled || !integrationConfigured(item)
                "
                @click="testIntegration(item)"
              >
                {{ testingIntegration === item.id ? 'Sending…' : 'Send test message' }}
              </button>
            </div>
          </div>
        </template>

        <div>
          <h3 style="margin: 0 0 0.35rem; font-size: 0.95rem">Notify Administrators when</h3>
          <p class="help">Notifications will be sent to emails and integrated applications.</p>
          <table class="table">
            <tbody>
              <tr v-for="(value, key) in settings.notify_when" :key="key">
                <td style="width: 1%">
                  <input v-model="value.active" type="checkbox" @change="save()" />
                </td>
                <td>
                  <div style="font-weight: 600">{{ value.title }}</div>
                  <div class="help">{{ value.description }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card stack">
        <h2 class="section-title">User permissions</h2>
        <div v-for="(perms, context) in settings.user_permissions" :key="context" class="perm-block">
          <h3 style="margin: 0 0 0.5rem; font-size: 0.9rem">{{ String(context).toUpperCase() }}</h3>
          <div class="row" style="flex-wrap: wrap; gap: 1rem">
            <label v-for="(val, key) in perms" :key="key" class="row" style="gap: 0.35rem">
              <input
                v-model="settings.user_permissions[context][key as keyof typeof perms]"
                type="checkbox"
                @change="save()"
              />
              <span>{{ key }}</span>
            </label>
          </div>
        </div>
      </section>

      <button class="btn btn-primary" type="submit" :disabled="saving" style="width: 100%">
        {{ saving ? 'Saving...' : 'Save settings' }}
      </button>
    </form>

    <div v-if="configuring" class="modal-overlay" @click.self="closeIntegrationConfig">
      <div class="modal-panel" style="width: min(440px, 100%)" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2 style="margin: 0; font-size: 1.1rem; text-transform: uppercase">
            Configure {{ configuring.name }}
          </h2>
          <button class="banner-close" type="button" @click="closeIntegrationConfig">×</button>
        </div>
        <div class="modal-body stack">
          <p v-if="integrationError" class="error" style="margin: 0">{{ integrationError }}</p>
          <div>
            <label class="label">
              {{ configuring.name }} Webhook URL <span class="error">*</span>
            </label>
            <input
              v-model="webhookDraft"
              class="input"
              type="url"
              :placeholder="
                configuring.id === 'discord'
                  ? 'https://discord.com/api/webhooks/...'
                  : 'https://hooks.slack.com/services/...'
              "
              autocomplete="off"
            />
            <p class="help">
              <template v-if="configuring.id === 'discord'">
                Create a webhook in your Discord channel settings (Integrations → Webhooks), then paste the
                URL here.
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
            @click="saveIntegration"
          >
            {{ saving ? 'Saving…' : '✓ Submit changes' }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="configuringTransport && (smtpDraft || mailgunDraft)"
      class="modal-overlay"
      @click.self="closeTransportModal"
    >
      <div class="modal-panel" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2 style="margin: 0; font-size: 1.1rem; text-transform: uppercase">
            Configure {{ configuringTransport.name }}
          </h2>
          <button class="banner-close" type="button" @click="closeTransportModal">×</button>
        </div>
        <div class="modal-body stack">
          <p v-if="transportError" class="error" style="margin: 0">{{ transportError }}</p>

          <template v-if="configuringTransport.name === 'smtp' && smtpDraft">
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

          <template v-else-if="configuringTransport.name === 'mailgun' && mailgunDraft">
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
            @click="submitTransport"
          >
            {{ saving ? 'Saving…' : '✓ Submit changes' }}
          </button>
          <button
            v-if="configuringTransport.name === 'smtp' && smtpDraft"
            class="btn"
            type="button"
            style="width: 100%"
            :disabled="testingSmtp || saving"
            @click="testSmtp"
          >
            {{ testingSmtp ? 'Sending…' : 'Send test email' }}
          </button>
          <p v-if="configuringTransport.name === 'smtp'" class="help" style="margin: 0">
            Test uses the values above and sends to your admin account email. Make sure the default
            sender address in Settings is allowed by your SMTP provider.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-title {
  margin: 0;
  font-size: 1.15rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border, rgba(127, 127, 127, 0.25));
}
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
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
.check-row {
  align-items: flex-start;
  gap: 0.65rem;
}
.tab-btn {
  border: 1px solid var(--border, rgba(127, 127, 127, 0.3));
  background: transparent;
  border-radius: 8px;
  padding: 0.4rem 0.7rem;
  cursor: pointer;
  color: var(--text);
}
.tab-btn.active {
  background: var(--surface-2, rgba(127, 127, 127, 0.15));
  font-weight: 600;
}
.transport,
.integration {
  border: 1px solid var(--border, rgba(127, 127, 127, 0.3));
  border-radius: 10px;
  padding: 0.85rem;
  text-align: left;
  background: transparent;
  color: var(--text);
}
.transport.active,
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
.integration-logo {
  display: flex;
  justify-content: center;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--panel-nav-bg);
}
.integration-icon {
  width: 72px;
  height: 72px;
  object-fit: contain;
  display: block;
}
.ok-inline {
  color: var(--ok);
  font-weight: 600;
}
.transport-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.transport-select {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0;
  font: inherit;
}
.check {
  font-size: 1.1rem;
  line-height: 1;
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
.transport.active .gear-btn {
  color: inherit;
}
.perm-block {
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--surface-2, rgba(127, 127, 127, 0.08));
}
@media (max-width: 800px) {
  .grid-2,
  .grid-3 {
    grid-template-columns: 1fr;
  }
}
</style>
