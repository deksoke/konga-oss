<script setup lang="ts">
import ChipInput from '~/components/plugins/ChipInput.vue'

const emit = defineEmits<{
  close: []
  created: [service: unknown]
}>()

defineOptions({ name: 'CreateServiceModal' })

const { kongFetch } = useKong()

const saving = ref(false)
const error = ref('')
const errors = ref<Record<string, string>>({})

const form = reactive({
  name: '',
  description: '',
  tags: [] as unknown[],
  url: '',
  protocol: '',
  host: '',
  port: null as number | null,
  path: '',
  retries: 5 as number | null,
  connect_timeout: 60000 as number | null,
  write_timeout: 60000 as number | null,
  read_timeout: 60000 as number | null,
  client_certificate_id: ''
})

const PROTOCOLS = ['http', 'https', 'grpc', 'grpcs', 'tcp', 'tls', 'udp']

function clearEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value === '' || value === null || value === undefined) continue
    if (Array.isArray(value) && value.length === 0) continue
    out[key] = value
  }
  return out as Partial<T>
}

function validate(): boolean {
  const next: Record<string, string> = {}
  const hasUrl = Boolean(form.url.trim())
  const hasHost = Boolean(form.host.trim())

  if (!hasUrl && !hasHost) {
    next.url = 'Provide a URL shorthand, or set Host (and optionally Protocol/Port/Path).'
    next.host = 'Host is required when URL is not set.'
  }

  if (form.protocol.trim() && !PROTOCOLS.includes(form.protocol.trim().toLowerCase())) {
    next.protocol = `Protocol must be one of: ${PROTOCOLS.join(', ')}`
  }

  if (form.port != null && (Number.isNaN(Number(form.port)) || Number(form.port) < 0 || Number(form.port) > 65535)) {
    next.port = 'Port must be between 0 and 65535.'
  }

  for (const key of ['retries', 'connect_timeout', 'write_timeout', 'read_timeout'] as const) {
    const value = form[key]
    if (value != null && (Number.isNaN(Number(value)) || Number(value) < 0)) {
      next[key] = 'Must be a non-negative number.'
    }
  }

  if (form.path && form.path.trim() && !form.path.trim().startsWith('/')) {
    next.path = 'Path must start with /'
  }

  errors.value = next
  return Object.keys(next).length === 0
}

function buildPayload() {
  const payload: Record<string, unknown> = clearEmpty({
    name: form.name.trim(),
    url: form.url.trim(),
    protocol: form.protocol.trim().toLowerCase(),
    host: form.host.trim(),
    path: form.path.trim(),
    retries: form.retries == null || form.retries === ('' as any) ? undefined : Number(form.retries),
    connect_timeout:
      form.connect_timeout == null || form.connect_timeout === ('' as any)
        ? undefined
        : Number(form.connect_timeout),
    write_timeout:
      form.write_timeout == null || form.write_timeout === ('' as any)
        ? undefined
        : Number(form.write_timeout),
    read_timeout:
      form.read_timeout == null || form.read_timeout === ('' as any)
        ? undefined
        : Number(form.read_timeout)
  })

  if (form.port != null && form.port !== ('' as any) && !Number.isNaN(Number(form.port))) {
    payload.port = Number(form.port)
  }

  if (form.tags.length) {
    payload.tags = form.tags.map(String)
  }

  if (form.client_certificate_id.trim()) {
    payload.client_certificate = { id: form.client_certificate_id.trim() }
  }

  // If URL shorthand is used, prefer it (Kong write-only); drop empty protocol/host noise already cleared
  return payload
}

async function submit() {
  error.value = ''
  errors.value = {}
  if (import.meta.client && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  await nextTick()
  if (!validate()) {
    error.value = 'Submission failed. Make sure you have completed all required fields.'
    useNotify().error(error.value)
    return
  }

  saving.value = true
  try {
    const created = (await kongFetch('services', {
      method: 'POST',
      body: buildPayload()
    })) as { id?: string }
    if (created?.id && form.description.trim()) {
      await $fetch('/api/service-extras', {
        method: 'PUT',
        body: {
          serviceId: created.id,
          description: form.description
        }
      }).catch(() => null)
    }
    useNotify().success('Service created successfully')
    emit('created', created)
  } catch (e: any) {
    const body = e?.data?.data || e?.data
    if (body?.fields && typeof body.fields === 'object') {
      for (const [k, v] of Object.entries(body.fields)) {
        errors.value[k] = typeof v === 'string' ? v : JSON.stringify(v)
      }
    }
    error.value =
      body?.message ||
      e?.data?.statusMessage ||
      e?.message ||
      'Submission failed. Make sure you have completed all required fields.'
    useNotify().error(error.value)
  } finally {
    saving.value = false
  }
}

function onOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) emit('close')
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="modal-overlay" @click="onOverlayClick">
    <div class="modal-panel" role="dialog" aria-modal="true" aria-label="Create Service">
      <div class="modal-header">
        <h2 style="margin: 0; text-transform: uppercase; font-size: 1.1rem">Create Service</h2>
        <button class="banner-close" type="button" aria-label="Close" @click="emit('close')">×</button>
      </div>

      <div class="modal-body stack">
        <p v-if="error" class="error">{{ error }}</p>

        <div class="plugin-form">
          <div class="plugin-form-row" :class="{ 'has-field-error': errors.name }">
            <label class="plugin-form-label">
              Name
              <em class="field-hint">optional</em>
            </label>
            <div class="plugin-form-control">
              <input v-model="form.name" class="input" />
              <p v-if="errors.name" class="error" style="margin: 0.25rem 0 0">{{ errors.name }}</p>
              <p class="field-help">The service name.</p>
            </div>
          </div>

          <div class="plugin-form-row">
            <label class="plugin-form-label">
              Description
              <em class="field-hint">optional</em>
            </label>
            <div class="plugin-form-control">
              <input v-model="form.description" class="input" />
              <p class="field-help">An optional service description. (UI-only; not stored by Kong Admin API)</p>
            </div>
          </div>

          <div class="plugin-form-row">
            <label class="plugin-form-label">
              Tags
              <em class="field-hint">optional</em>
            </label>
            <div class="plugin-form-control">
              <ChipInput v-model="form.tags" placeholder="Add tag…" />
              <p class="field-help">Optionally add tags to the service</p>
            </div>
          </div>

          <div class="plugin-form-row" :class="{ 'has-field-error': errors.url }">
            <label class="plugin-form-label">
              Url
              <em class="field-hint">shorthand-attribute</em>
            </label>
            <div class="plugin-form-control">
              <input v-model="form.url" class="input" placeholder="https://example.com/api" />
              <p v-if="errors.url" class="error" style="margin: 0.25rem 0 0">{{ errors.url }}</p>
              <p class="field-help">
                Shorthand attribute to set <code>protocol</code>, <code>host</code>, <code>port</code> and
                <code>path</code> at once. This attribute is write-only (the Admin API never "returns" the url).
              </p>
            </div>
          </div>

          <div class="plugin-form-row" :class="{ 'has-field-error': errors.protocol }">
            <label class="plugin-form-label">
              Protocol
              <em class="field-hint">semi-optional</em>
            </label>
            <div class="plugin-form-control">
              <select v-model="form.protocol" class="select">
                <option value="">—</option>
                <option v-for="p in PROTOCOLS" :key="p" :value="p">{{ p }}</option>
              </select>
              <p v-if="errors.protocol" class="error" style="margin: 0.25rem 0 0">{{ errors.protocol }}</p>
              <p class="field-help">
                The protocol used to communicate with the upstream. It can be one of <code>http</code> or
                <code>https</code> (Kong also supports grpc/grpcs/tcp/tls/udp).
              </p>
            </div>
          </div>

          <div class="plugin-form-row" :class="{ 'has-field-error': errors.host }">
            <label class="plugin-form-label">
              Host
              <em class="field-hint">semi-optional</em>
            </label>
            <div class="plugin-form-control">
              <input v-model="form.host" class="input" />
              <p v-if="errors.host" class="error" style="margin: 0.25rem 0 0">{{ errors.host }}</p>
              <p class="field-help">The host of the upstream server.</p>
            </div>
          </div>

          <div class="plugin-form-row" :class="{ 'has-field-error': errors.port }">
            <label class="plugin-form-label">
              Port
              <em class="field-hint">semi-optional</em>
            </label>
            <div class="plugin-form-control">
              <input v-model.number="form.port" class="input" type="number" min="0" max="65535" />
              <p v-if="errors.port" class="error" style="margin: 0.25rem 0 0">{{ errors.port }}</p>
              <p class="field-help">The upstream server port. Defaults to <code>80</code>.</p>
            </div>
          </div>

          <div class="plugin-form-row" :class="{ 'has-field-error': errors.path }">
            <label class="plugin-form-label">
              Path
              <em class="field-hint">optional</em>
            </label>
            <div class="plugin-form-control">
              <input v-model="form.path" class="input" />
              <p v-if="errors.path" class="error" style="margin: 0.25rem 0 0">{{ errors.path }}</p>
              <p class="field-help">The path to be used in requests to the upstream server. Empty by default.</p>
            </div>
          </div>

          <div class="plugin-form-row" :class="{ 'has-field-error': errors.retries }">
            <label class="plugin-form-label">
              Retries
              <em class="field-hint">optional</em>
            </label>
            <div class="plugin-form-control">
              <input v-model.number="form.retries" class="input" type="number" min="0" />
              <p v-if="errors.retries" class="error" style="margin: 0.25rem 0 0">{{ errors.retries }}</p>
              <p class="field-help">The number of retries to execute upon failure to proxy. The default is <code>5</code>.</p>
            </div>
          </div>

          <div class="plugin-form-row" :class="{ 'has-field-error': errors.connect_timeout }">
            <label class="plugin-form-label">
              Connect timeout
              <em class="field-hint">optional</em>
            </label>
            <div class="plugin-form-control">
              <input v-model.number="form.connect_timeout" class="input" type="number" min="0" />
              <p v-if="errors.connect_timeout" class="error" style="margin: 0.25rem 0 0">{{ errors.connect_timeout }}</p>
              <p class="field-help">
                The timeout in milliseconds for establishing a connection to your upstream server. Defaults to
                <code>60000</code>
              </p>
            </div>
          </div>

          <div class="plugin-form-row" :class="{ 'has-field-error': errors.write_timeout }">
            <label class="plugin-form-label">
              Write timeout
              <em class="field-hint">optional</em>
            </label>
            <div class="plugin-form-control">
              <input v-model.number="form.write_timeout" class="input" type="number" min="0" />
              <p v-if="errors.write_timeout" class="error" style="margin: 0.25rem 0 0">{{ errors.write_timeout }}</p>
              <p class="field-help">
                The timeout in milliseconds between two successive write operations for transmitting a request to the
                upstream server. Defaults to <code>60000</code>
              </p>
            </div>
          </div>

          <div class="plugin-form-row" :class="{ 'has-field-error': errors.read_timeout }">
            <label class="plugin-form-label">
              Read timeout
              <em class="field-hint">optional</em>
            </label>
            <div class="plugin-form-control">
              <input v-model.number="form.read_timeout" class="input" type="number" min="0" />
              <p v-if="errors.read_timeout" class="error" style="margin: 0.25rem 0 0">{{ errors.read_timeout }}</p>
              <p class="field-help">
                The timeout in milliseconds between two successive read operations for transmitting a request to the
                upstream server. Defaults to <code>60000</code>
              </p>
            </div>
          </div>

          <div class="plugin-form-row" :class="{ 'has-field-error': errors.client_certificate }">
            <label class="plugin-form-label">
              Client certificate
              <em class="field-hint">optional</em>
            </label>
            <div class="plugin-form-control">
              <input v-model="form.client_certificate_id" class="input" />
              <p v-if="errors.client_certificate" class="error" style="margin: 0.25rem 0 0">
                {{ errors.client_certificate }}
              </p>
              <p class="field-help">
                Certificate (<code>id</code>) to be used as client certificate while TLS handshaking to the upstream
                server.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer modal-footer-stretch">
        <button class="btn btn-primary plugin-submit" type="button" :disabled="saving" @click="submit">
          {{ saving ? 'Submitting…' : '✓ Submit Service' }}
        </button>
      </div>
    </div>
  </div>
</template>
