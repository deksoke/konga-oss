<script setup lang="ts">
import ChipInput from '~/components/plugins/ChipInput.vue'
import CreateRouteModal from '~/components/services/CreateRouteModal.vue'
import SelectServicePluginModal from '~/components/services/SelectServicePluginModal.vue'
import AddPluginModal from '~/components/plugins/AddPluginModal.vue'
import EditPluginModal from '~/components/plugins/EditPluginModal.vue'
import EligibleConsumersPanel from '~/components/EligibleConsumersPanel.vue'

const route = useRoute()
const router = useRouter()
const { kongFetch } = useKong()

type Tab = 'details' | 'routes' | 'plugins' | 'consumers'

const service = ref<any>(null)
const routes = ref<any[]>([])
const plugins = ref<any[]>([])
const error = ref('')
const success = ref('')
const saving = ref(false)
const fieldErrors = ref<Record<string, string>>({})

const showCreateRoute = ref(false)
const editingRoute = ref<any | null>(null)
const showPluginPicker = ref(false)
const selectedPlugin = ref<{ name: string; description: string } | null>(null)
const editingPlugin = ref<any | null>(null)

const tab = computed<Tab>(() => {
  const q = String(route.query.tab || 'details')
  if (['details', 'routes', 'plugins', 'consumers'].includes(q)) return q as Tab
  return 'details'
})

const form = reactive({
  name: '',
  description: '',
  tags: [] as unknown[],
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

const sections = [
  { id: 'details' as Tab, label: 'Service Details' },
  { id: 'routes' as Tab, label: 'Routes' },
  { id: 'plugins' as Tab, label: 'Plugins' },
  { id: 'consumers' as Tab, label: 'Eligible consumers', beta: true }
]

const PROTOCOLS = ['http', 'https', 'grpc', 'grpcs', 'tcp', 'tls', 'udp']

const existingPluginNames = computed(() => plugins.value.map((p) => p.name).filter(Boolean))

function setTab(id: Tab) {
  router.replace({ query: { ...route.query, tab: id === 'details' ? undefined : id } })
}

function fillForm(s: any) {
  form.name = s.name || ''
  form.description = typeof s.extras?.description === 'string' ? s.extras.description : ''
  form.tags = [...(s.tags || [])]
  form.protocol = s.protocol || ''
  form.host = s.host || ''
  form.port = s.port ?? null
  form.path = s.path || ''
  form.retries = s.retries ?? 5
  form.connect_timeout = s.connect_timeout ?? 60000
  form.write_timeout = s.write_timeout ?? 60000
  form.read_timeout = s.read_timeout ?? 60000
  form.client_certificate_id = s.client_certificate?.id || ''
}

async function load() {
  error.value = ''
  try {
    const id = String(route.params.id)
    const [svc, extras] = await Promise.all([
      kongFetch<any>(`services/${id}`),
      $fetch<{ data: { description: string } }>('/api/service-extras', {
        query: { serviceId: id }
      }).catch(() => ({ data: { description: '' } }))
    ])
    service.value = {
      ...svc,
      extras: { description: extras.data?.description || '' }
    }
    form.description = extras.data?.description || ''
    fillForm(service.value)
    const [routesRes, pluginsRes] = await Promise.all([
      kongFetch<{ data: any[] }>(`services/${id}/routes`, { query: { size: 1000 } }),
      kongFetch<{ data: any[] }>(`services/${id}/plugins`, { query: { size: 1000 } }).catch(() => ({ data: [] }))
    ])
    routes.value = routesRes.data || []
    plugins.value = pluginsRes.data || []
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Failed to load service'
  }
}

async function updateService() {
  error.value = ''
  success.value = ''
  fieldErrors.value = {}
  if (import.meta.client && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  await nextTick()
  saving.value = true
  try {
    const body: Record<string, unknown> = {
      name: form.name.trim() || null,
      protocol: form.protocol.trim().toLowerCase() || undefined,
      host: form.host.trim() || undefined,
      path: form.path.trim() || null,
      retries: form.retries == null ? undefined : Number(form.retries),
      connect_timeout: form.connect_timeout == null ? undefined : Number(form.connect_timeout),
      write_timeout: form.write_timeout == null ? undefined : Number(form.write_timeout),
      read_timeout: form.read_timeout == null ? undefined : Number(form.read_timeout),
      port: form.port == null || Number.isNaN(Number(form.port)) ? undefined : Number(form.port),
      client_certificate: form.client_certificate_id.trim()
        ? { id: form.client_certificate_id.trim() }
        : null,
      tags: form.tags.map(String)
    }
    // Drop undefined keys only (keep null so Kong can clear optional fields)
    for (const key of Object.keys(body)) {
      if (body[key] === undefined) delete body[key]
    }

    const [updated] = await Promise.all([
      kongFetch<any>(`services/${route.params.id}`, { method: 'PATCH', body }),
      $fetch('/api/service-extras', {
        method: 'PUT',
        body: {
          serviceId: String(route.params.id),
          description: form.description
        }
      })
    ])
    service.value = {
      ...updated,
      extras: { description: form.description.trim() }
    }
    fillForm(service.value)
    success.value = 'Service updated'
    useNotify().success('Service updated successfully')
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

async function removeRoute(id: string) {
  if (!confirm('Delete route?')) return
  try {
    await kongFetch(`routes/${id}`, { method: 'DELETE' })
    useNotify().success('Route deleted')
    await load()
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Failed to delete route')
  }
}

async function removePlugin(id: string) {
  if (!confirm('Delete plugin?')) return
  try {
    await kongFetch(`plugins/${id}`, { method: 'DELETE' })
    useNotify().success('Plugin deleted')
    await load()
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Failed to delete plugin')
  }
}

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

function onRouteCreated() {
  showCreateRoute.value = false
  editingRoute.value = null
  load()
}

function openEditRoute(routeItem: any) {
  editingRoute.value = routeItem
}

function onPluginSelect(plugin: { name: string; description: string }) {
  showPluginPicker.value = false
  selectedPlugin.value = plugin
}

function onPluginCreated() {
  selectedPlugin.value = null
  load()
}

function onPluginUpdated() {
  editingPlugin.value = null
  load()
}

onMounted(load)
watch(() => route.params.id, load)
</script>

<template>
  <div class="stack">
    <div>
      <h1 style="margin: 0">Service {{ service?.name || service?.id || '' }}</h1>
      <p class="muted" style="margin: 0.35rem 0 0">
        <NuxtLink to="/services">services</NuxtLink>
        <span> / show</span>
      </p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="ok">{{ success }}</p>

    <div v-if="!service" class="card muted">Loading…</div>

    <div v-else class="entity-layout">
      <nav class="entity-nav" aria-label="Service sections">
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
        <!-- DETAILS -->
        <template v-if="tab === 'details'">
          <div class="entity-panel-title">Service details</div>
          <div class="plugin-form">
            <div class="plugin-form-row">
              <label class="plugin-form-label">Name<em class="field-hint">optional</em></label>
              <div class="plugin-form-control">
                <input v-model="form.name" class="input" />
                <p v-if="fieldErrors.name" class="error">{{ fieldErrors.name }}</p>
                <p class="field-help">The service name.</p>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Description<em class="field-hint">optional</em></label>
              <div class="plugin-form-control">
                <input v-model="form.description" class="input" />
                <p class="field-help">An optional service description.</p>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Tags<em class="field-hint">optional</em></label>
              <div class="plugin-form-control">
                <ChipInput v-model="form.tags" />
                <p class="field-help">Optionally add tags to the service</p>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Protocol<em class="field-hint">semi-optional</em></label>
              <div class="plugin-form-control">
                <select v-model="form.protocol" class="select">
                  <option value="">—</option>
                  <option v-for="p in PROTOCOLS" :key="p" :value="p">{{ p }}</option>
                </select>
                <p class="field-help">
                  The protocol used to communicate with the upstream. It can be one of <code>http</code> or
                  <code>https</code>.
                </p>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Host<em class="field-hint">semi-optional</em></label>
              <div class="plugin-form-control">
                <input v-model="form.host" class="input" />
                <p class="field-help">The host of the upstream server.</p>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Port<em class="field-hint">semi-optional</em></label>
              <div class="plugin-form-control">
                <input v-model.number="form.port" class="input" type="number" />
                <p class="field-help">The upstream server port. Defaults to <code>80</code>.</p>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Path<em class="field-hint">optional</em></label>
              <div class="plugin-form-control">
                <input v-model="form.path" class="input" />
                <p class="field-help">The path to be used in requests to the upstream server. Empty by default.</p>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Retries<em class="field-hint">optional</em></label>
              <div class="plugin-form-control">
                <input v-model.number="form.retries" class="input" type="number" />
                <p class="field-help">The number of retries to execute upon failure to proxy. The default is <code>5</code>.</p>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Connect timeout<em class="field-hint">optional</em></label>
              <div class="plugin-form-control">
                <input v-model.number="form.connect_timeout" class="input" type="number" />
                <p class="field-help">
                  The timeout in milliseconds for establishing a connection to your upstream server. Defaults to
                  <code>60000</code>
                </p>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Write timeout<em class="field-hint">optional</em></label>
              <div class="plugin-form-control">
                <input v-model.number="form.write_timeout" class="input" type="number" />
                <p class="field-help">
                  The timeout in milliseconds between two successive write operations for transmitting a request to the
                  upstream server. Defaults to <code>60000</code>
                </p>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Read timeout<em class="field-hint">optional</em></label>
              <div class="plugin-form-control">
                <input v-model.number="form.read_timeout" class="input" type="number" />
                <p class="field-help">
                  The timeout in milliseconds between two successive read operations for transmitting a request to the
                  upstream server. Defaults to <code>60000</code>
                </p>
              </div>
            </div>
            <div class="plugin-form-row">
              <label class="plugin-form-label">Client certificate<em class="field-hint">optional</em></label>
              <div class="plugin-form-control">
                <input v-model="form.client_certificate_id" class="input" />
                <p class="field-help">
                  Certificate (<code>id</code>) to be used as client certificate while TLS handshaking to the upstream
                  server.
                </p>
              </div>
            </div>
          </div>
          <button class="btn btn-primary" type="button" :disabled="saving" @click="updateService">
            {{ saving ? 'Saving…' : '✓ Submit changes' }}
          </button>
        </template>

        <!-- ROUTES -->
        <template v-else-if="tab === 'routes'">
          <div class="entity-panel-title">Routes</div>
          <div class="row" style="justify-content: space-between">
            <button class="btn btn-primary" type="button" @click="showCreateRoute = true">+ Add Route</button>
            <span class="muted">{{ routes.length }} route(s)</span>
          </div>
          <div class="card" style="overflow-x: auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Paths</th>
                  <th>Methods</th>
                  <th>Hosts</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in routes" :key="r.id">
                  <td>
                    <button class="plugin-name-btn" type="button" @click="openEditRoute(r)">
                      <strong>{{ r.name || r.id }}</strong>
                    </button>
                  </td>
                  <td>{{ (r.paths || []).join(', ') || '—' }}</td>
                  <td>{{ (r.methods || []).join(', ') || '—' }}</td>
                  <td>{{ (r.hosts || []).join(', ') || '—' }}</td>
                  <td>
                    <div class="row" style="gap: 0.35rem; justify-content: flex-end">
                      <button class="btn btn-edit" type="button" @click="openEditRoute(r)">Edit</button>
                      <button class="btn btn-danger" type="button" @click="removeRoute(r.id)">Delete</button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!routes.length">
                  <td colspan="5" class="muted" style="text-align: center">No routes yet</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- PLUGINS -->
        <template v-else-if="tab === 'plugins'">
          <div class="entity-panel-title">Plugins</div>
          <div class="row" style="justify-content: space-between">
            <button class="btn btn-primary" type="button" @click="showPluginPicker = true">+ Add Plugin</button>
            <span class="muted">{{ plugins.length }} plugin(s) on this service</span>
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
                  <td colspan="6" class="muted" style="text-align: center">No plugins on this service</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- CONSUMERS -->
        <template v-else>
          <EligibleConsumersPanel v-if="service" entity="services" :entity-id="String(service.id)" />
        </template>
      </div>
    </div>

    <CreateRouteModal
      v-if="showCreateRoute && service"
      :service-id="String(service.id)"
      :service-name="service.name"
      @close="showCreateRoute = false"
      @saved="onRouteCreated"
    />

    <CreateRouteModal
      v-if="editingRoute && service"
      :service-id="String(service.id)"
      :service-name="service.name"
      :route="editingRoute"
      @close="editingRoute = null"
      @saved="onRouteCreated"
    />

    <SelectServicePluginModal
      v-if="showPluginPicker && service"
      :service-id="String(service.id)"
      :existing-names="existingPluginNames"
      @close="showPluginPicker = false"
      @select="onPluginSelect"
    />

    <AddPluginModal
      v-if="selectedPlugin && service"
      :plugin-name="selectedPlugin.name"
      :description="selectedPlugin.description"
      :service-id="String(service.id)"
      @close="selectedPlugin = null"
      @created="onPluginCreated"
    />

    <EditPluginModal
      v-if="editingPlugin"
      :plugin="editingPlugin"
      @close="editingPlugin = null"
      @updated="onPluginUpdated"
    />
  </div>
</template>
