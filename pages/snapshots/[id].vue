<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { user } = useAuth()

type Snapshot = {
  id: string
  name: string
  kongNodeName: string
  kongNodeUrl: string
  kongVersion: string
  createdAt: string
  data: Record<string, any[]>
}

type ConnectionOption = { id: string; name: string; kongAdminUrl: string }

const ENTITY_PAGE_SIZE = 20
const TAB_KEY = (snapId: string) => `konga:snapshot-tab:${snapId}`

const snap = ref<Snapshot | null>(null)
const error = ref('')
const activeKey = ref('')
const filters = reactive<Record<string, string>>({})
const entityPage = ref(1)
const showRestore = ref(false)
const restoring = ref(false)
const restoreDone = ref(false)
const results = ref<Record<string, { imported: number; failed: { count: number; items: string[] } }>>({})
const selected = reactive<Record<string, boolean>>({})
const connections = ref<ConnectionOption[]>([])
const restoreNodeId = ref('')

const entityKeys = computed(() => (snap.value ? Object.keys(snap.value.data || {}) : []))

const filteredItems = computed(() => {
  if (!snap.value || !activeKey.value) return []
  const q = (filters[activeKey.value] || '').trim().toLowerCase()
  const list = snap.value.data[activeKey.value] || []
  if (!q) return list
  return list.filter((item) => JSON.stringify(item).toLowerCase().includes(q))
})

const entityTotalPages = computed(() =>
  Math.max(1, Math.ceil(filteredItems.value.length / ENTITY_PAGE_SIZE))
)

const entityPageRange = computed(() => {
  const total = filteredItems.value.length
  if (!total) return { from: 0, to: 0 }
  const from = (entityPage.value - 1) * ENTITY_PAGE_SIZE + 1
  const to = Math.min(entityPage.value * ENTITY_PAGE_SIZE, total)
  return { from, to }
})

const pagedItems = computed(() => {
  const start = (entityPage.value - 1) * ENTITY_PAGE_SIZE
  return filteredItems.value.slice(start, start + ENTITY_PAGE_SIZE)
})

const restoreNode = computed(() => {
  const nodeId = restoreNodeId.value || user.value?.activeNodeId || ''
  return connections.value.find((c) => c.id === nodeId) || null
})

function persistActiveTab(key: string) {
  if (!import.meta.client || !key) return
  sessionStorage.setItem(TAB_KEY(id.value), key)
}

function restoreActiveTab(keys: string[]) {
  if (!import.meta.client || !keys.length) return
  const saved = sessionStorage.getItem(TAB_KEY(id.value))
  if (saved && keys.includes(saved)) activeKey.value = saved
}

function setActiveKey(key: string) {
  activeKey.value = key
  entityPage.value = 1
  persistActiveTab(key)
}

watch([activeKey, () => filters[activeKey.value]], () => {
  entityPage.value = 1
})

watch(entityTotalPages, (pages) => {
  if (entityPage.value > pages) entityPage.value = pages
})

async function loadConnections() {
  const res = await $fetch<{ data: ConnectionOption[] }>('/api/nodes')
  connections.value = res.data || []
}

async function load() {
  error.value = ''
  try {
    const res = await $fetch<{ data: Snapshot }>(`/api/snapshots/${id.value}`)
    snap.value = res.data
    const keys = Object.keys(res.data.data || {})
    activeKey.value = keys[0] || ''
    for (const key of keys) {
      selected[key] = false
      filters[key] = filters[key] || ''
    }
    restoreActiveTab(keys)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Snapshot not found'
    snap.value = null
  }
}

async function download() {
  try {
    const data = await $fetch(`/api/snapshots/${id.value}/download`)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `snapshot_${id.value}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Export failed')
  }
}

async function openRestore() {
  restoreDone.value = false
  results.value = {}
  restoreNodeId.value = user.value?.activeNodeId || ''
  if (!connections.value.length) {
    try {
      await loadConnections()
    } catch {
      /* optional for display */
    }
  }
  showRestore.value = true
}

async function restore() {
  const imports = Object.keys(selected).filter((k) => selected[k])
  if (!imports.length) return
  const nodeId = restoreNodeId.value || user.value?.activeNodeId
  if (!nodeId) {
    useNotify().error('Select a Kong connection for restore')
    return
  }
  restoring.value = true
  try {
    const res = await $fetch<{ data: typeof results.value }>(`/api/snapshots/${id.value}/restore`, {
      method: 'POST',
      body: { imports, nodeId }
    })
    results.value = res.data || {}
    restoreDone.value = true
    useNotify().success('Restore finished')
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Restore failed')
  } finally {
    restoring.value = false
  }
}

onMounted(load)
watch(id, load)
</script>

<template>
  <div class="stack">
    <p v-if="error && !snap" class="error">{{ error }}</p>
    <template v-if="snap">
      <div class="row" style="justify-content: space-between; align-items: flex-start">
        <div>
          <h1 style="margin: 0">{{ snap.name }}@{{ snap.kongNodeName }}</h1>
          <p class="muted" style="margin: 0.35rem 0 0">
            Kong {{ (snap.kongVersion || '').split('-').join('.') || '—' }} ·
            {{ new Date(snap.createdAt).toLocaleString() }}
          </p>
        </div>
        <div class="row">
          <button class="btn btn-primary" type="button" @click="openRestore">Restore</button>
          <button class="btn" type="button" @click="download">Export</button>
          <NuxtLink class="btn" to="/snapshots">Back</NuxtLink>
        </div>
      </div>

      <div class="tabs row" style="gap: 0.35rem; flex-wrap: wrap">
        <button
          v-for="key in entityKeys"
          :key="key"
          class="tab-btn"
          type="button"
          :class="{ active: activeKey === key }"
          @click="setActiveKey(key)"
        >
          {{ key.toUpperCase().split('_').join(' ') }}
          <span class="muted">({{ (snap.data[key] || []).length }})</span>
        </button>
      </div>

      <div v-if="activeKey" class="stack">
        <input
          v-model="filters[activeKey]"
          class="input"
          style="max-width: 28rem"
          type="search"
          placeholder="Search items..."
        />
        <div v-for="(item, idx) in pagedItems" :key="idx" class="card json-block">
          <pre class="dashboard-json">{{ JSON.stringify(item, null, 2) }}</pre>
        </div>
        <p v-if="!filteredItems.length" class="muted">No items.</p>
        <ListPagination
          v-else-if="filteredItems.length > ENTITY_PAGE_SIZE"
          :from="entityPageRange.from"
          :to="entityPageRange.to"
          :total="filteredItems.length"
          :page="entityPage"
          :total-pages="entityTotalPages"
          :page-size="ENTITY_PAGE_SIZE"
          :show-page-size="false"
          @update:page="entityPage = $event"
        />
      </div>
    </template>

    <div v-if="showRestore" class="modal-overlay" @click.self="showRestore = false">
      <div class="modal-panel modal-panel-wide" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2 style="margin: 0; font-size: 1.1rem">Restore Snapshot {{ snap?.name }}</h2>
          <button class="banner-close" type="button" @click="showRestore = false">×</button>
        </div>
        <div class="modal-body stack">
          <template v-if="!restoreDone">
            <h3 style="margin: 0; font-size: 1rem">Select objects to import</h3>
            <p class="muted" style="margin: 0">
              Selected objects will be applied to
              <strong>{{ restoreNode?.name || 'the chosen connection' }}</strong>.
            </p>
            <div>
              <label class="label">Kong connection</label>
              <select v-model="restoreNodeId" class="select">
                <option value="" disabled>Select a connection</option>
                <option v-for="c in connections" :key="c.id" :value="c.id">
                  {{ c.name }} — {{ c.kongAdminUrl }}
                </option>
              </select>
            </div>
            <div class="row" style="flex-wrap: wrap; gap: 0.75rem">
              <label v-for="key in entityKeys" :key="key" class="row" style="gap: 0.35rem">
                <input v-model="selected[key]" type="checkbox" />
                <span>{{ key }}</span>
              </label>
            </div>
            <button
              class="btn btn-primary"
              type="button"
              :disabled="restoring || !Object.values(selected).some(Boolean) || !restoreNodeId"
              @click="restore"
            >
              {{ restoring ? 'Please wait...' : 'Import objects' }}
            </button>
          </template>
          <template v-else>
            <table class="table">
              <thead>
                <tr>
                  <th>Object</th>
                  <th>Imported</th>
                  <th>Failed</th>
                  <th>Failed items</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(value, key) in results" :key="key">
                  <td>{{ key }}</td>
                  <td style="color: var(--ok)"><strong>{{ value.imported }}</strong></td>
                  <td style="color: var(--danger)"><strong>{{ value.failed.count }}</strong></td>
                  <td>
                    <ol v-if="value.failed.items.length" style="margin: 0; padding-left: 1.1rem">
                      <li v-for="(msg, i) in value.failed.items" :key="i"><code>{{ msg }}</code></li>
                    </ol>
                    <span v-else class="muted">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-btn {
  border: 1px solid var(--border);
  background: transparent;
  border-radius: 8px;
  padding: 0.4rem 0.7rem;
  cursor: pointer;
  color: var(--text);
}
.tab-btn.active {
  background: var(--panel-nav-bg);
  font-weight: 600;
}
.json-block pre {
  margin: 0;
}
</style>
