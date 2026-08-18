<script setup lang="ts">
import ChipInput from '~/components/plugins/ChipInput.vue'
import SelectServicePluginModal from '~/components/services/SelectServicePluginModal.vue'
import AddPluginModal from '~/components/plugins/AddPluginModal.vue'
import EditPluginModal from '~/components/plugins/EditPluginModal.vue'
import EligibleConsumersPanel from '~/components/EligibleConsumersPanel.vue'

const route = useRoute()
const router = useRouter()
const { kongFetch } = useKong()

type Tab = 'details' | 'plugins' | 'consumers'

const item = ref<any>(null)
const plugins = ref<any[]>([])
const error = ref('')
const success = ref('')
const saving = ref(false)
const fieldErrors = ref<Record<string, string>>({})
const showPluginPicker = ref(false)
const selectedPlugin = ref<{ name: string; description: string } | null>(null)
const editingPlugin = ref<any | null>(null)

const tab = computed<Tab>(() => {
  const q = String(route.query.tab || 'details')
  if (['details', 'plugins', 'consumers'].includes(q)) return q as Tab
  return 'details'
})

const form = reactive({
  name: '',
  tags: [] as unknown[],
  hosts: [] as unknown[],
  paths: [] as unknown[],
  methods: [] as unknown[],
  protocols: [] as unknown[],
  snis: [] as unknown[],
  headers: [] as unknown[],
  sources: [] as unknown[],
  destinations: [] as unknown[],
  path_handling: 'v1',
  https_redirect_status_code: 426 as number | null,
  regex_priority: 0 as number | null,
  strip_path: true,
  preserve_host: false,
  service_id: ''
})

const sections = [
  { id: 'details' as Tab, label: 'Route Details' },
  { id: 'plugins' as Tab, label: 'Plugins' },
  { id: 'consumers' as Tab, label: 'Eligible consumers', beta: true }
]

const existingPluginNames = computed(() => plugins.value.map((p) => p.name).filter(Boolean))

function setTab(id: Tab) {
  router.replace({ query: { ...route.query, tab: id === 'details' ? undefined : id } })
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? [...value] : []
}

function headersToChips(headers: Record<string, string[]> | null | undefined): unknown[] {
  if (!headers || typeof headers !== 'object') return []
  return Object.entries(headers).map(([k, v]) => `${k}:${(v || []).join(',')}`)
}

function chipsToHeaders(chips: unknown[]): Record<string, string[]> | undefined {
  if (!chips.length) return undefined
  const out: Record<string, string[]> = {}
  for (const chip of chips) {
    const text = String(chip)
    const idx = text.indexOf(':')
    if (idx < 0) continue
    const key = text.slice(0, idx).trim()
    const vals = text
      .slice(idx + 1)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (key) out[key] = vals
  }
  return Object.keys(out).length ? out : undefined
}

function ipPortChips(list: Array<{ ip?: string; port?: number }> | null | undefined): unknown[] {
  if (!Array.isArray(list)) return []
  return list.map((x) => {
    if (x.ip && x.port != null) return `${x.ip}:${x.port}`
    return x.ip || (x.port != null ? String(x.port) : '')
  }).filter(Boolean)
}

function chipsToIpPort(chips: unknown[]) {
  return chips
    .map((c) => {
      const text = String(c)
      const [ip, port] = text.split(':')
      if (ip && port) return { ip, port: Number(port) }
      if (ip) return { ip }
      return null
    })
    .filter(Boolean)
}

function fillForm(r: any) {
  form.name = r.name || ''
  form.tags = asList(r.tags)
  form.hosts = asList(r.hosts)
  form.paths = asList(r.paths)
  form.methods = asList(r.methods)
  form.protocols = asList(r.protocols?.length ? r.protocols : ['http', 'https'])
  form.snis = asList(r.snis)
  form.headers = headersToChips(r.headers)
  form.sources = ipPortChips(r.sources)
  form.destinations = ipPortChips(r.destinations)
  form.path_handling = r.path_handling || 'v1'
  form.https_redirect_status_code = r.https_redirect_status_code ?? 426
  form.regex_priority = r.regex_priority ?? 0
  form.strip_path = Boolean(r.strip_path)
  form.preserve_host = Boolean(r.preserve_host)
  form.service_id = r.service?.id || ''
}

async function load() {
  error.value = ''
  try {
    const id = String(route.params.id)
    item.value = await kongFetch(`routes/${id}`)
    fillForm(item.value)
    const res = await kongFetch<{ data: any[] }>(`routes/${id}/plugins`, {
      query: { size: 1000 }
    }).catch(() => ({ data: [] }))
    plugins.value = res.data || []
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Failed to load route'
  }
}

async function submit() {
  error.value = ''
  success.value = ''
  fieldErrors.value = {}

  // Commit any chip drafts that were typed but not confirmed with Enter
  if (import.meta.client && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  await nextTick()

  if (!form.hosts.length && !form.paths.length && !form.methods.length) {
    error.value = 'At least one of hosts, paths, or methods must be set.'
    return
  }
  saving.value = true
  try {
    const protocols = form.protocols.map(String)
    // Kong only allows sources/destinations for stream protocols (tcp/tls/udp).
    // Sending [] with http/https triggers schema violations even on no-op save.
    const allowsStreamFields =
      protocols.length > 0 && protocols.every((p) => ['tcp', 'tls', 'udp'].includes(p))

    // Always send list fields (including []) so Kong clears removed values
    const body: Record<string, unknown> = {
      name: form.name.trim() || null,
      hosts: form.hosts.map(String),
      paths: form.paths.map(String),
      methods: form.methods.map(String),
      protocols,
      snis: form.snis.map(String),
      headers: chipsToHeaders(form.headers) ?? {},
      path_handling: form.path_handling,
      https_redirect_status_code:
        form.https_redirect_status_code == null ? undefined : Number(form.https_redirect_status_code),
      regex_priority: form.regex_priority == null ? undefined : Number(form.regex_priority),
      strip_path: form.strip_path,
      preserve_host: form.preserve_host,
      service: form.service_id.trim() ? { id: form.service_id.trim() } : undefined,
      tags: form.tags.map(String)
    }
    if (allowsStreamFields) {
      body.sources = chipsToIpPort(form.sources)
      body.destinations = chipsToIpPort(form.destinations)
    }
    for (const key of Object.keys(body)) {
      if (body[key] === undefined) delete body[key]
    }

    item.value = await kongFetch(`routes/${route.params.id}`, { method: 'PATCH', body })
    fillForm(item.value)
    success.value = 'Route updated'
    useNotify().success('Route updated successfully')
  } catch (e: any) {
    const body = e?.data?.data || e?.data
    if (body?.fields) {
      for (const [k, v] of Object.entries(body.fields)) {
        fieldErrors.value[k] = typeof v === 'string' ? v : JSON.stringify(v)
      }
    }
    error.value = body?.message || e?.data?.statusMessage || 'Update failed'
    useNotify().error(error.value)
  } finally {
    saving.value = false
  }
}

onMounted(load)
watch(() => route.params.id, load)

function pluginIconSrc(name: string) {
  return `/images/kong/plugins/${name}.png`
}

function onPluginIconError(event: Event) {
  const img = event.target as HTMLImageElement
  if (img.dataset.fallback === '1') return
  img.dataset.fallback = '1'
  img.src = '/images/kong/plugins/kong.svg'
}

function formatCreated(ts?: number) {
  if (!ts) return '—'
  const ms = ts > 1e12 ? ts : ts * 1000
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function consumerId(p: any): string | null {
  return p?.consumer?.id || p?.consumer_id || null
}

const sortedPlugins = computed(() =>
  [...plugins.value].sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
)

async function togglePlugin(plugin: any, event: Event) {
  const input = event.target as HTMLInputElement
  const next = input.checked
  const prev = Boolean(plugin.enabled)
  plugin.enabled = next
  try {
    await kongFetch(`plugins/${plugin.id}`, { method: 'PATCH', body: { enabled: next } })
    useNotify().success(`Plugin ${plugin.name} ${next ? 'enabled' : 'disabled'}`)
  } catch (e: any) {
    plugin.enabled = prev
    input.checked = prev
    useNotify().error(e?.data?.statusMessage || 'Failed to update plugin')
  }
}

async function removePlugin(pluginId: string) {
  if (!confirm('Delete plugin?')) return
  try {
    await kongFetch(`plugins/${pluginId}`, { method: 'DELETE' })
    useNotify().success('Plugin deleted')
    await load()
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Delete failed')
  }
}

function onPluginSelect(p: { name: string; description: string }) {
  showPluginPicker.value = false
  selectedPlugin.value = p
}
</script>

<template>
  <div class="stack">
    <div>
      <h1 style="margin: 0">Route {{ item?.name || item?.id || '' }}</h1>
      <p class="muted" style="margin: 0.35rem 0 0">
        <NuxtLink to="/routes">routes</NuxtLink>
        <span> / show</span>
      </p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="ok">{{ success }}</p>

    <div v-if="!item" class="card muted">Loading…</div>

    <div v-else class="entity-layout">
      <nav class="entity-nav" aria-label="Route sections">
        <button
          v-for="s in sections"
          :key="s.id"
          type="button"
          class="entity-nav-item"
          :class="{ active: tab === s.id }"
          @click="setTab(s.id)"
        >
          <span>{{ s.label }}</span>
          <span v-if="s.beta" class="beta-badge">beta</span>
        </button>
      </nav>

      <div class="entity-panel stack">
        <template v-if="tab === 'details'">
          <div class="entity-panel-title">Route details</div>
          <div class="info-banner" style="margin-bottom: 0.5rem">
            <small>
              * For hosts, paths, methods and protocols, snis, sources, headers and destinations press Enter to apply
              every value you type
            </small>
            <span />
          </div>

          <div class="plugin-form">
            <div class="plugin-form-row">
              <label class="plugin-form-label">Name<em class="field-hint">optional</em></label>
              <div class="plugin-form-control">
                <input v-model="form.name" class="input" />
                <p class="field-help">The name of the Route.</p>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Tags<em class="field-hint">optional</em></label>
              <div class="plugin-form-control">
                <ChipInput v-model="form.tags" placeholder="Add a tag and press Enter" />
                <p v-if="fieldErrors.tags" class="error">{{ fieldErrors.tags }}</p>
                <p class="field-help">Optionally add tags to the route. Press Enter after each tag.</p>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Hosts<em class="field-hint">semi-optional</em></label>
              <div class="plugin-form-control">
                <ChipInput v-model="form.hosts" />
                <p v-if="fieldErrors.hosts" class="error">{{ fieldErrors.hosts }}</p>
                <p class="field-help">
                  A list of domain names that match this Route. At least one of hosts, paths, or methods must be set.
                </p>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Paths<em class="field-hint">semi-optional</em></label>
              <div class="plugin-form-control">
                <ChipInput v-model="form.paths" />
                <p class="field-help">
                  A list of paths that match this Route. For example: <code>/my-path</code>.
                </p>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Headers<em class="field-hint">semi-optional</em></label>
              <div class="plugin-form-control">
                <ChipInput v-model="form.headers" placeholder="x-some-header:foo,bar" />
                <p class="field-help">
                  Format example: <code>x-some-header:foo,bar</code>
                </p>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Methods<em class="field-hint">semi-optional</em></label>
              <div class="plugin-form-control">
                <ChipInput v-model="form.methods" placeholder="GET" />
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Protocols<em class="field-hint">semi-optional</em></label>
              <div class="plugin-form-control">
                <ChipInput v-model="form.protocols" placeholder="http" />
                <p class="field-help">Defaults to <code>["http", "https"]</code>.</p>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Path handling</label>
              <div class="plugin-form-control">
                <select v-model="form.path_handling" class="select">
                  <option value="v0">v0</option>
                  <option value="v1">v1</option>
                </select>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Https redirect status code<em class="field-hint">optional</em></label>
              <div class="plugin-form-control">
                <input v-model.number="form.https_redirect_status_code" class="input" type="number" />
                <p class="field-help">Defaults to <code>426</code>.</p>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Regex priority<em class="field-hint">optional</em></label>
              <div class="plugin-form-control">
                <input v-model.number="form.regex_priority" class="input" type="number" />
                <p class="field-help">Defaults to <code>0</code>.</p>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Strip Path<em class="field-hint">optional</em></label>
              <div class="plugin-form-control">
                <label class="toggle">
                  <input v-model="form.strip_path" type="checkbox" />
                  <span class="toggle-track"><span class="toggle-thumb" /></span>
                  <span class="toggle-label">{{ form.strip_path ? 'YES' : 'NO' }}</span>
                </label>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Preserve Host<em class="field-hint">optional</em></label>
              <div class="plugin-form-control">
                <label class="toggle">
                  <input v-model="form.preserve_host" type="checkbox" />
                  <span class="toggle-track"><span class="toggle-thumb" /></span>
                  <span class="toggle-label">{{ form.preserve_host ? 'YES' : 'NO' }}</span>
                </label>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">SNIs<em class="field-hint">semi-optional</em></label>
              <div class="plugin-form-control">
                <ChipInput v-model="form.snis" />
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Sources<em class="field-hint">semi-optional</em></label>
              <div class="plugin-form-control">
                <ChipInput v-model="form.sources" placeholder="192.168.1.2:3000" />
                <p class="field-help">Format: <code>ip:port</code></p>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Destinations<em class="field-hint">semi-optional</em></label>
              <div class="plugin-form-control">
                <ChipInput v-model="form.destinations" placeholder="192.168.1.2:3000" />
                <p class="field-help">Format: <code>ip:port</code></p>
              </div>
            </div>
          </div>

          <button class="btn btn-primary" type="button" :disabled="saving" @click="submit">
            {{ saving ? 'Saving…' : '✓ Submit changes' }}
          </button>
        </template>

        <template v-else-if="tab === 'plugins'">
          <div class="entity-panel-title">Plugins</div>
          <div class="row" style="justify-content: space-between">
            <button class="btn btn-primary" type="button" @click="showPluginPicker = true">+ Add Plugin</button>
            <span class="muted">{{ plugins.length }} plugin(s) on this route</span>
          </div>
          <div class="card" style="overflow-x: auto; padding: 0">
            <table class="table">
              <thead>
                <tr>
                  <th style="width: 1%" />
                  <th style="width: 1%" />
                  <th>Name</th>
                  <th>Consumer</th>
                  <th>Created</th>
                  <th style="width: 1%" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in sortedPlugins" :key="p.id" class="plugin-row">
                  <td>
                    <img
                      class="plugin-icon"
                      :src="pluginIconSrc(p.name)"
                      :alt="p.name"
                      width="42"
                      height="42"
                      loading="lazy"
                      @error="onPluginIconError"
                    />
                  </td>
                  <td>
                    <label class="toggle" :title="p.enabled ? 'Enabled' : 'Disabled'">
                      <input
                        type="checkbox"
                        :checked="Boolean(p.enabled)"
                        @change="togglePlugin(p, $event)"
                      />
                      <span class="toggle-track" aria-hidden="true">
                        <span class="toggle-thumb" />
                      </span>
                    </label>
                  </td>
                  <td>
                    <button class="plugin-name-btn" type="button" @click="editingPlugin = p">
                      <strong>{{ p.name }}</strong>
                    </button>
                  </td>
                  <td>
                    <NuxtLink
                      v-if="consumerId(p)"
                      :to="`/consumers/${consumerId(p)}`"
                      class="mono-id"
                    >
                      {{ consumerId(p) }}
                    </NuxtLink>
                    <span v-else class="muted">All consumers</span>
                  </td>
                  <td class="text-nowrap">{{ formatCreated(p.created_at) }}</td>
                  <td>
                    <button class="btn btn-danger" type="button" @click="removePlugin(p.id)">
                      Delete
                    </button>
                  </td>
                </tr>
                <tr v-if="!sortedPlugins.length">
                  <td colspan="6" class="muted" style="text-align: center">No plugins on this route</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-else>
          <EligibleConsumersPanel v-if="item" entity="routes" :entity-id="String(item.id)" />
        </template>
      </div>
    </div>

    <SelectServicePluginModal
      v-if="showPluginPicker && item"
      scope="route"
      :route-id="String(item.id)"
      :existing-names="existingPluginNames"
      @close="showPluginPicker = false"
      @select="onPluginSelect"
    />

    <AddPluginModal
      v-if="selectedPlugin && item"
      :plugin-name="selectedPlugin.name"
      :description="selectedPlugin.description"
      :route-id="String(item.id)"
      @close="selectedPlugin = null"
      @created="selectedPlugin = null; load()"
    />

    <EditPluginModal
      v-if="editingPlugin"
      :plugin="editingPlugin"
      @close="editingPlugin = null"
      @updated="editingPlugin = null; load()"
    />
  </div>
</template>
