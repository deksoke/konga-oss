<script setup lang="ts">
import ChipInput from '~/components/plugins/ChipInput.vue'
import CredentialModal from '~/components/consumers/CredentialModal.vue'
import SelectServicePluginModal from '~/components/services/SelectServicePluginModal.vue'
import AddPluginModal from '~/components/plugins/AddPluginModal.vue'
import EditPluginModal from '~/components/plugins/EditPluginModal.vue'

const route = useRoute()
const router = useRouter()
const { kongFetch } = useKong()

type Tab = 'details' | 'groups' | 'credentials' | 'services' | 'plugins'
type CredType = 'basic-auth' | 'key-auth' | 'hmac-auth' | 'jwt' | 'oauth2'

const id = computed(() => String(route.params.id))
const consumer = ref<any>(null)
const error = ref('')
const success = ref('')
const saving = ref(false)
const gatewayPlugins = ref<Record<string, unknown>>({})
const acls = ref<any[]>([])
const plugins = ref<any[]>([])
const accessible = ref<any[]>([])
const credentials = reactive<Record<CredType, any[]>>({
  'basic-auth': [],
  'key-auth': [],
  'hmac-auth': [],
  jwt: [],
  oauth2: []
})

const newGroup = ref('')
const credType = ref<CredType>('key-auth')
const showCredModal = ref(false)
const editingCred = ref<any | null>(null)
const showPluginPicker = ref(false)
const selectedPlugin = ref<{ name: string; description: string } | null>(null)
const editingPlugin = ref<any | null>(null)

const form = reactive({
  username: '',
  custom_id: '',
  tags: [] as unknown[]
})

const tab = computed<Tab>(() => {
  const q = String(route.query.tab || 'details')
  if (['details', 'groups', 'credentials', 'services', 'plugins'].includes(q)) return q as Tab
  return 'details'
})

const hasAcl = computed(() => Boolean(gatewayPlugins.value.acl))

const sections = computed(() => {
  const base: Array<{ id: Tab; label: string }> = [{ id: 'details', label: 'Details' }]
  if (hasAcl.value) {
    base.push({ id: 'groups', label: 'Groups' })
  }
  base.push({ id: 'credentials', label: 'Credentials' })
  if (hasAcl.value) {
    base.push({ id: 'services', label: 'Accessible Routes' })
  }
  base.push({ id: 'plugins', label: 'Plugins' })
  return base
})

const credentialGroups = computed(() => {
  const all: Array<{ id: CredType; label: string }> = [
    { id: 'basic-auth', label: 'BASIC' },
    { id: 'key-auth', label: 'API KEYS' },
    { id: 'hmac-auth', label: 'HMAC' },
    { id: 'oauth2', label: 'OAUTH2' },
    { id: 'jwt', label: 'JWT' }
  ]
  return all.filter((g) => gatewayPlugins.value[g.id])
})

const existingPluginNames = computed(() => plugins.value.map((p) => p.name).filter(Boolean))

function setTab(t: Tab) {
  router.replace({ query: { ...route.query, tab: t === 'details' ? undefined : t } })
}

async function loadGateway() {
  try {
    const info = await kongFetch<{ plugins?: { available_on_server?: Record<string, unknown> } }>('')
    gatewayPlugins.value = (info.plugins?.available_on_server as Record<string, unknown>) || {}
  } catch {
    gatewayPlugins.value = {}
  }
}

async function loadConsumer() {
  consumer.value = await kongFetch(`consumers/${id.value}`)
  form.username = consumer.value.username || ''
  form.custom_id = consumer.value.custom_id || ''
  form.tags = [...(consumer.value.tags || [])]
}

async function loadAcls() {
  if (!hasAcl.value) {
    acls.value = []
    return
  }
  try {
    const res = await kongFetch<{ data: any[] }>(`consumers/${id.value}/acls`, { query: { size: 1000 } })
    acls.value = res.data || []
  } catch {
    acls.value = []
  }
}

async function loadCredentials() {
  for (const g of credentialGroups.value) {
    try {
      const res = await kongFetch<{ data: any[] }>(`consumers/${id.value}/${g.id}`, {
        query: { size: 1000 }
      })
      credentials[g.id] = res.data || []
    } catch {
      credentials[g.id] = []
    }
  }
}

async function loadPlugins() {
  try {
    const res = await kongFetch<{ data: any[] }>(`consumers/${id.value}/plugins`, {
      query: { size: 1000 }
    })
    plugins.value = res.data || []
  } catch {
    plugins.value = []
  }
}

async function loadAccessible() {
  if (!hasAcl.value) {
    accessible.value = []
    return
  }
  try {
    const res = await $fetch<{ data: any[] }>(`/api/kong-consumers/${id.value}/services`)
    accessible.value = res.data || []
  } catch {
    accessible.value = []
  }
}

async function load() {
  error.value = ''
  try {
    await loadGateway()
    await loadConsumer()
    await Promise.all([loadAcls(), loadCredentials(), loadPlugins(), loadAccessible()])
    if (credentialGroups.value.length && !credentialGroups.value.some((g) => g.id === credType.value)) {
      credType.value = credentialGroups.value[0].id
    }
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Failed to load consumer'
  }
}

async function saveDetails() {
  saving.value = true
  error.value = ''
  success.value = ''
  try {
    const body: Record<string, unknown> = {
      username: form.username.trim() || null,
      custom_id: form.custom_id.trim() || null,
      tags: form.tags.map(String)
    }
    consumer.value = await kongFetch(`consumers/${id.value}`, { method: 'PATCH', body })
    success.value = 'Consumer updated'
    useNotify().success(success.value)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Update failed'
    useNotify().error(error.value)
  } finally {
    saving.value = false
  }
}

async function addGroup() {
  const group = newGroup.value.trim()
  if (!group) return
  try {
    await kongFetch(`consumers/${id.value}/acls`, { method: 'POST', body: { group } })
    newGroup.value = ''
    useNotify().success('Group added')
    await loadAcls()
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Failed to add group')
  }
}

async function removeAcl(aclId: string) {
  if (!confirm('Delete this group?')) return
  try {
    await kongFetch(`consumers/${id.value}/acls/${aclId}`, { method: 'DELETE' })
    useNotify().success('Group deleted')
    await loadAcls()
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Delete failed')
  }
}

function openCreateCred(type: CredType) {
  credType.value = type
  editingCred.value = null
  showCredModal.value = true
}

function openEditBasic(item: any) {
  credType.value = 'basic-auth'
  editingCred.value = item
  showCredModal.value = true
}

async function removeCred(type: CredType, credId: string) {
  if (!confirm('Delete credential?')) return
  try {
    await kongFetch(`consumers/${id.value}/${type}/${credId}`, { method: 'DELETE' })
    useNotify().success('Credential deleted')
    await loadCredentials()
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Delete failed')
  }
}

async function removePlugin(pluginId: string) {
  if (!confirm('Delete plugin?')) return
  try {
    await kongFetch(`plugins/${pluginId}`, { method: 'DELETE' })
    useNotify().success('Plugin deleted')
    await loadPlugins()
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Delete failed')
  }
}

function onPluginSelect(p: { name: string; description: string }) {
  showPluginPicker.value = false
  selectedPlugin.value = p
}

onMounted(load)
watch(id, load)
watch(tab, (t) => {
  if (t === 'services') loadAccessible()
  if (t === 'credentials') loadCredentials()
})
</script>

<template>
  <div class="stack">
    <div class="row" style="justify-content: space-between; align-items: center">
      <div>
        <NuxtLink to="/consumers">← Consumers</NuxtLink>
        <h1 style="margin: 0.35rem 0 0">{{ consumer?.username || consumer?.custom_id || 'Consumer' }}</h1>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="muted">{{ success }}</p>

    <div class="entity-layout" v-if="consumer">
      <aside class="entity-nav card" style="padding: 0.75rem">
        <button
          v-for="s in sections"
          :key="s.id"
          class="nav-pill"
          type="button"
          :class="{ active: tab === s.id }"
          @click="setTab(s.id)"
        >
          {{ s.label }}
        </button>
      </aside>

      <div class="stack">
        <template v-if="tab === 'details'">
          <div class="entity-panel-title">Details</div>
          <div class="card stack">
            <div>
              <label class="label">username <em class="muted">semi-optional</em></label>
              <input v-model="form.username" class="input" />
            </div>
            <div>
              <label class="label">custom_id <em class="muted">semi-optional</em></label>
              <input v-model="form.custom_id" class="input" />
            </div>
            <div>
              <label class="label">tags</label>
              <ChipInput v-model="form.tags" placeholder="Add a tag and press Enter" />
            </div>
            <button class="btn btn-primary" type="button" :disabled="saving" @click="saveDetails">
              {{ saving ? 'Saving…' : 'Submit changes' }}
            </button>
          </div>
        </template>

        <template v-else-if="tab === 'groups'">
          <div class="entity-panel-title">Groups</div>
          <div class="row" style="flex-wrap: wrap; gap: 0.75rem">
            <div v-for="acl in acls" :key="acl.id" class="group-card card">
              <strong>{{ acl.group }}</strong>
              <button class="btn-link-danger" type="button" @click="removeAcl(acl.id)">Delete</button>
            </div>
            <div class="group-card card dashed stack">
              <input v-model="newGroup" class="input" placeholder="Group name" @keydown.enter="addGroup" />
              <button class="btn btn-primary" type="button" @click="addGroup">Add a group</button>
            </div>
          </div>
        </template>

        <template v-else-if="tab === 'credentials'">
          <div class="entity-panel-title">Credentials</div>
          <div class="cred-layout">
            <aside class="stack">
              <button
                v-for="g in credentialGroups"
                :key="g.id"
                class="nav-pill"
                type="button"
                :class="{ active: credType === g.id }"
                @click="credType = g.id"
              >
                {{ g.label }}
                <span class="muted">({{ credentials[g.id].length }})</span>
              </button>
              <p v-if="!credentialGroups.length" class="muted">No auth plugins available on this gateway.</p>
            </aside>
            <div v-if="credentialGroups.length" class="card stack">
              <div class="row" style="justify-content: space-between">
                <h3 style="margin: 0">{{ credType }}</h3>
                <button class="btn btn-primary" type="button" @click="openCreateCred(credType)">+ Create</button>
              </div>

              <table class="table">
                <thead>
                  <tr>
                    <th v-if="credType === 'basic-auth' || credType === 'hmac-auth'">Username</th>
                    <th v-if="credType === 'key-auth'">Key</th>
                    <th v-if="credType === 'jwt'">Key / Alg</th>
                    <th v-if="credType === 'oauth2'">Name</th>
                    <th>ID</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in credentials[credType]" :key="item.id">
                    <td v-if="credType === 'basic-auth'">
                      <button class="plugin-name-btn" type="button" @click="openEditBasic(item)">
                        {{ item.username }}
                      </button>
                    </td>
                    <td v-else-if="credType === 'hmac-auth'">{{ item.username }}</td>
                    <td v-else-if="credType === 'key-auth'"><code>{{ item.key }}</code></td>
                    <td v-else-if="credType === 'jwt'">
                      <div>{{ item.key || '—' }}</div>
                      <div class="muted">{{ item.algorithm }}</div>
                    </td>
                    <td v-else-if="credType === 'oauth2'">
                      <div><strong>{{ item.name }}</strong></div>
                      <div class="muted">{{ item.client_id }}</div>
                    </td>
                    <td class="mono-id">{{ item.id }}</td>
                    <td>
                      <button class="btn-link-danger" type="button" @click="removeCred(credType, item.id)">
                        Delete
                      </button>
                    </td>
                  </tr>
                  <tr v-if="!credentials[credType].length">
                    <td colspan="4" class="muted" style="text-align: center">No credentials yet</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>

        <template v-else-if="tab === 'services'">
          <div class="entity-panel-title">Accessible Routes</div>
          <div v-for="svc in accessible" :key="svc.id" class="card stack" style="margin-bottom: 0.75rem">
            <div class="row" style="justify-content: space-between">
              <div>
                <NuxtLink :to="`/services/${svc.id}`"><strong>{{ svc.name || svc.id }}</strong></NuxtLink>
                <div class="muted">{{ svc.host }}</div>
              </div>
              <div class="row" style="flex-wrap: wrap; gap: 0.25rem">
                <span v-for="p in svc.plugins || []" :key="p.id" class="tag">{{ p.name }}</span>
              </div>
            </div>
            <table class="table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Hosts</th>
                  <th>Paths</th>
                  <th>Methods</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in svc.routes || []" :key="r.id">
                  <td><NuxtLink :to="`/routes/${r.id}`">{{ r.name || r.id }}</NuxtLink></td>
                  <td>{{ (r.hosts || []).join(', ') || '—' }}</td>
                  <td>{{ (r.paths || []).join(', ') || '—' }}</td>
                  <td>{{ (r.methods || []).join(', ') || '—' }}</td>
                </tr>
                <tr v-if="!(svc.routes || []).length">
                  <td colspan="4" class="muted">No accessible routes</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="!accessible.length" class="muted">No accessible services/routes for this consumer.</p>
        </template>

        <template v-else>
          <div class="entity-panel-title">Plugins</div>
          <div class="row" style="justify-content: space-between">
            <button class="btn btn-primary" type="button" @click="showPluginPicker = true">+ Add Plugin</button>
            <span class="muted">{{ plugins.length }} plugin(s)</span>
          </div>
          <div class="card" style="overflow-x: auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Enabled</th>
                  <th>ID</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in plugins" :key="p.id">
                  <td>
                    <button class="plugin-name-btn" type="button" @click="editingPlugin = p">
                      <strong>{{ p.name }}</strong>
                    </button>
                  </td>
                  <td>{{ p.enabled ? 'On' : 'Off' }}</td>
                  <td class="mono-id">{{ p.id }}</td>
                  <td>
                    <button class="btn-link-danger" type="button" @click="removePlugin(p.id)">Delete</button>
                  </td>
                </tr>
                <tr v-if="!plugins.length">
                  <td colspan="4" class="muted" style="text-align: center">No plugins</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </div>

    <CredentialModal
      v-if="showCredModal"
      :type="credType"
      :consumer-id="id"
      :editing="editingCred"
      @close="showCredModal = false"
      @saved="showCredModal = false; loadCredentials()"
    />

    <SelectServicePluginModal
      v-if="showPluginPicker"
      scope="consumer"
      :existing-names="existingPluginNames"
      @close="showPluginPicker = false"
      @select="onPluginSelect"
    />

    <AddPluginModal
      v-if="selectedPlugin"
      :plugin-name="selectedPlugin.name"
      :description="selectedPlugin.description"
      :locked-consumer-id="id"
      @close="selectedPlugin = null"
      @created="selectedPlugin = null; loadPlugins()"
    />

    <EditPluginModal
      v-if="editingPlugin"
      :plugin="editingPlugin"
      @close="editingPlugin = null"
      @updated="editingPlugin = null; loadPlugins()"
    />
  </div>
</template>

<style scoped>
.entity-layout {
  display: grid;
  grid-template-columns: 12rem 1fr;
  gap: 1rem;
}
.entity-nav {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  height: fit-content;
}
.nav-pill {
  border: 0;
  background: transparent;
  text-align: left;
  padding: 0.55rem 0.7rem;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text);
}
.nav-pill.active {
  background: var(--surface-2, rgba(127, 127, 127, 0.15));
  font-weight: 600;
}
.cred-layout {
  display: grid;
  grid-template-columns: 10rem 1fr;
  gap: 1rem;
}
.group-card {
  min-width: 10rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.group-card.dashed {
  border-style: dashed;
}
.tag {
  display: inline-block;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: var(--surface-2, rgba(127, 127, 127, 0.15));
  font-size: 0.75rem;
}
@media (max-width: 800px) {
  .entity-layout,
  .cred-layout {
    grid-template-columns: 1fr;
  }
}
</style>
