<script setup lang="ts">
import {
  buildPluginPayload,
  humanizeLabel,
  initFormValues,
  parsePluginSchema,
  type SchemaFieldDef
} from '~/utils/kongPluginSchema'
import { pluginDisplayName } from '~/utils/pluginGroups'
import PluginSchemaField from '~/components/plugins/PluginSchemaField.vue'

const props = defineProps<{
  pluginName: string
  description?: string
  /** When set, the plugin is attached to this Kong service */
  serviceId?: string
  /** When set, the plugin is attached to this Kong route */
  routeId?: string
  /** When set, locks consumer field to this id */
  lockedConsumerId?: string
}>()

const emit = defineEmits<{
  close: []
  created: [plugin: unknown]
}>()

defineOptions({ name: 'AddPluginModal' })

const { kongFetch } = useKong()

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const fieldErrors = ref<Record<string, string>>({})

const configFields = ref<Record<string, SchemaFieldDef>>({})
const topFields = ref<Record<string, SchemaFieldDef>>({})
const configValues = ref<Record<string, unknown>>({})
const enabled = ref(true)
const consumerId = ref('')
const showAdvancedJson = ref(false)
const configJsonText = ref('')

const title = computed(() => `Add ${pluginDisplayName(props.pluginName)}`)

const configEntries = computed(() => Object.entries(configFields.value))

async function loadSchema() {
  loading.value = true
  error.value = ''
  try {
    const schema = await kongFetch<any>(`plugins/schema/${props.pluginName}`)
    const parsed = parsePluginSchema(schema)
    configFields.value = parsed.config
    topFields.value = parsed.topLevel
    configValues.value = initFormValues(parsed.config)

    if (parsed.topLevel.enabled?.default !== undefined) {
      enabled.value = Boolean(parsed.topLevel.enabled.default)
    }

    configJsonText.value = JSON.stringify(configValues.value, null, 2)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || 'Failed to load plugin schema'
  } finally {
    loading.value = false
  }
}

function syncJsonFromForm() {
  configJsonText.value = JSON.stringify(configValues.value, null, 2)
}

function applyJsonToForm() {
  try {
    const parsed = JSON.parse(configJsonText.value || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Config must be a JSON object')
    }
    configValues.value = parsed
    error.value = ''
  } catch (e: any) {
    error.value = e?.message || 'Invalid config JSON'
  }
}

async function submit() {
  error.value = ''
  fieldErrors.value = {}
  if (showAdvancedJson.value) {
    applyJsonToForm()
    if (error.value) return
  }

  saving.value = true
  try {
    const protocolsDef = topFields.value.protocols
    const protocols = protocolsDef?.default
    const payload = buildPluginPayload({
      name: props.pluginName,
      enabled: enabled.value,
      consumerId: consumerId.value.trim() || undefined,
      protocols: Array.isArray(protocols) ? protocols : undefined,
      config: { ...configValues.value },
      serviceId: props.serviceId,
      routeId: props.routeId
    })
    // Drop empty enum strings (e.g. unset strategy)
    if (payload.config && typeof payload.config === 'object') {
      const cfg = payload.config as Record<string, unknown>
      for (const [k, v] of Object.entries(cfg)) {
        if (v === '') delete cfg[k]
      }
    }
    const created = await kongFetch('plugins', { method: 'POST', body: payload })
    useNotify().success(`"${props.pluginName}" plugin added successfully`)
    emit('created', created)
  } catch (e: any) {
    const body = e?.data?.data || e?.data
    if (body?.fields && typeof body.fields === 'object') {
      for (const [k, v] of Object.entries(body.fields)) {
        fieldErrors.value[k] = typeof v === 'string' ? v : JSON.stringify(v)
      }
    }
    error.value = body?.message || e?.data?.statusMessage || e?.message || 'Failed to create plugin'
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

onMounted(() => {
  if (props.lockedConsumerId) consumerId.value = props.lockedConsumerId
  loadSchema()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
watch(showAdvancedJson, (v) => {
  if (v) syncJsonFromForm()
})
</script>

<template>
  <div class="modal-overlay" @click="onOverlayClick">
    <div class="modal-panel" role="dialog" aria-modal="true" :aria-label="title">
      <div class="modal-header">
        <h2 style="margin: 0; text-transform: uppercase; font-size: 1.1rem">{{ title }}</h2>
        <button class="banner-close" type="button" aria-label="Close" @click="emit('close')">×</button>
      </div>

      <div class="modal-subhead muted">
        {{ description || 'Configure the Plugin.' }}
      </div>

      <div class="modal-body stack">
        <p v-if="error" class="error">{{ error }}</p>
        <div v-if="loading" class="muted">Loading schema from Kong…</div>

        <template v-else>
          <div class="plugin-form">
            <div class="plugin-form-row">
              <label class="plugin-form-label">enabled</label>
              <div class="plugin-form-control">
                <label class="toggle">
                  <input v-model="enabled" type="checkbox" />
                  <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb" /></span>
                  <span class="toggle-label">{{ enabled ? 'YES' : 'NO' }}</span>
                </label>
              </div>
            </div>

            <div class="plugin-form-row">
              <label class="plugin-form-label">consumer</label>
              <div class="plugin-form-control">
                <input
                  v-model="consumerId"
                  class="input"
                  placeholder=""
                  :disabled="Boolean(lockedConsumerId)"
                />
                <p class="field-help">
                  The CONSUMER ID that this plugin configuration will target. This value can only be used if
                  authentication has been enabled so that the system can identify the user making the request. If
                  left blank, the plugin will be applied to all consumers.
                </p>
              </div>
            </div>

            <div class="row" style="justify-content: flex-end; margin: 0.25rem 0">
              <button class="btn" type="button" @click="showAdvancedJson = !showAdvancedJson">
                {{ showAdvancedJson ? 'Form fields' : 'Edit as JSON' }}
              </button>
            </div>

            <div v-if="showAdvancedJson" class="stack">
              <textarea v-model="configJsonText" class="textarea" rows="14" spellcheck="false" />
              <p class="field-help">Advanced: edit the raw <code>config</code> object sent to Kong Admin API.</p>
            </div>

            <template v-else>
              <div v-if="!configEntries.length" class="muted">
                This plugin has no configurable fields beyond defaults.
              </div>

              <div v-for="[key, def] in configEntries" :key="key" class="plugin-form-row">
                <label class="plugin-form-label">
                  {{ humanizeLabel(key) }}
                  <span v-if="def.required" class="error">*</span>
                </label>
                <div class="plugin-form-control">
                  <PluginSchemaField
                    :field-key="key"
                    :def="def"
                    :model-value="configValues[key]"
                    :error="fieldErrors[key] || fieldErrors[`config.${key}`]"
                    @update:model-value="configValues[key] = $event"
                  />
                </div>
              </div>
            </template>
          </div>
        </template>
      </div>

      <div class="modal-footer modal-footer-stretch">
        <button class="btn btn-primary plugin-submit" type="button" :disabled="loading || saving" @click="submit">
          {{ saving ? 'Adding…' : '✓ Add plugin' }}
        </button>
      </div>
    </div>
  </div>
</template>
