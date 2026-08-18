<script setup lang="ts">
import {
  buildPluginUpdatePayload,
  humanizeLabel,
  mergeExistingConfig,
  parsePluginSchema,
  type SchemaFieldDef
} from '~/utils/kongPluginSchema'
import { pluginDisplayName } from '~/utils/pluginGroups'
import PluginSchemaField from '~/components/plugins/PluginSchemaField.vue'

type EditablePlugin = {
  id: string
  name: string
  enabled?: boolean
  consumer?: { id: string } | null
  service?: { id: string } | null
  route?: { id: string } | null
  protocols?: string[]
  config?: Record<string, unknown> | null
}

const props = defineProps<{
  plugin: EditablePlugin
  description?: string
}>()

const emit = defineEmits<{
  close: []
  updated: [plugin: unknown]
}>()

defineOptions({ name: 'EditPluginModal' })

const { kongFetch } = useKong()

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const fieldErrors = ref<Record<string, string>>({})

const configFields = ref<Record<string, SchemaFieldDef>>({})
const configValues = ref<Record<string, unknown>>({})
const enabled = ref(true)
const consumerId = ref('')
const showAdvancedJson = ref(false)
const configJsonText = ref('')
const meta = ref<{ id: string; scope: string; applyTo: string }>({
  id: '',
  scope: 'global',
  applyTo: 'All Entrypoints'
})

const title = computed(() => `Edit ${pluginDisplayName(props.plugin.name)}`)
const configEntries = computed(() => Object.entries(configFields.value))

function describeScope(p: EditablePlugin) {
  if (p.service) return { scope: 'services', applyTo: p.service.id }
  if (p.route) return { scope: 'routes', applyTo: p.route.id }
  return { scope: 'global', applyTo: 'All Entrypoints' }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [schema, fresh] = await Promise.all([
      kongFetch<any>(`plugins/schema/${props.plugin.name}`),
      kongFetch<EditablePlugin>(`plugins/${props.plugin.id}`).catch(() => props.plugin)
    ])

    const parsed = parsePluginSchema(schema)
    configFields.value = parsed.config
    configValues.value = mergeExistingConfig(parsed.config, fresh.config || props.plugin.config || {})
    enabled.value = Boolean(fresh.enabled ?? props.plugin.enabled)
    consumerId.value = fresh.consumer?.id || props.plugin.consumer?.id || ''
    meta.value = { id: fresh.id || props.plugin.id, ...describeScope(fresh) }
    configJsonText.value = JSON.stringify(configValues.value, null, 2)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || 'Failed to load plugin'
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
    const payload = buildPluginUpdatePayload({
      enabled: enabled.value,
      consumerId: consumerId.value.trim() || undefined,
      config: { ...configValues.value }
    })
    const updated = await kongFetch(`plugins/${props.plugin.id}`, {
      method: 'PATCH',
      body: payload
    })
    useNotify().success(`"${props.plugin.name}" plugin updated successfully`)
    emit('updated', updated)
  } catch (e: any) {
    const body = e?.data?.data || e?.data
    if (body?.fields && typeof body.fields === 'object') {
      for (const [k, v] of Object.entries(body.fields)) {
        fieldErrors.value[k] = typeof v === 'string' ? v : JSON.stringify(v)
      }
    }
    error.value = body?.message || e?.data?.statusMessage || e?.message || 'Failed to update plugin'
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
  load()
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
        <div v-if="loading" class="muted">Loading plugin configuration…</div>

        <template v-else>
          <div class="plugin-meta-bar">
            <div>
              <div class="muted" style="font-size: 0.75rem">Plugin ID</div>
              <code class="mono-id">{{ meta.id }}</code>
            </div>
            <div>
              <div class="muted" style="font-size: 0.75rem">Scope</div>
              <strong>{{ meta.scope }}</strong>
            </div>
            <div style="min-width: 0">
              <div class="muted" style="font-size: 0.75rem">Apply to</div>
              <span class="mono-id">{{ meta.applyTo }}</span>
            </div>
          </div>

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
                <input v-model="consumerId" class="input" placeholder="" />
                <p class="field-help">
                  The CONSUMER ID that this plugin configuration will target. Leave blank to apply to all consumers.
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

      <div class="modal-footer">
        <button class="btn" type="button" :disabled="saving" @click="emit('close')">Cancel</button>
        <button class="btn btn-primary" type="button" :disabled="loading || saving" @click="submit">
          {{ saving ? 'Saving…' : '✓ Submit changes' }}
        </button>
      </div>
    </div>
  </div>
</template>
