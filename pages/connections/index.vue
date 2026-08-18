<script setup lang="ts">
import CreateConnectionModal from '~/components/connections/CreateConnectionModal.vue'
import EditConnectionModal from '~/components/connections/EditConnectionModal.vue'
import UiIcon from '~/components/UiIcon.vue'

type NodeRow = {
  id: string
  name: string
  kongAdminUrl: string
  authType: string
  hasApiKey?: boolean
  hasBasicAuth?: boolean
  hasJwt?: boolean
  createdAt?: string
  healthy?: boolean | null
  kongVersion?: string
  checking?: boolean
  healthChecks?: boolean
  healthCheckDetails?: {
    last_checked?: string | null
    last_failed?: string | null
    last_success?: string | null
    first_failed?: string | null
  } | null
}

type SortKey = 'name' | 'authType' | 'kongAdminUrl' | 'kongVersion' | 'created'

const { user, refresh } = useAuth()
const { refreshConnectionNodes } = useConnectionNodes()
const nodes = ref<NodeRow[]>([])
const error = ref('')
const showCreate = ref(false)
const editing = ref<NodeRow | null>(null)

const {
  search,
  pageSize,
  page,
  filtered,
  paged,
  totalPages,
  pageRange,
  toggleSort,
  sortArrow,
  goToPage,
  setPageSize,
  restore
} = useListTable<NodeRow, SortKey>({
  key: 'connections',
  items: nodes,
  defaultSortKey: 'created',
  defaultSortDesc: true,
  descKeys: ['created'],
  match: (n, q) =>
    [n.name, n.kongAdminUrl, n.authType, n.kongVersion].filter(Boolean).join(' ').toLowerCase().includes(q),
  sortValue: (n, key) => {
    if (key === 'created') return n.createdAt ? new Date(n.createdAt).getTime() : 0
    if (key === 'name') return n.name.toLowerCase()
    if (key === 'authType') return (n.authType || '').toLowerCase()
    if (key === 'kongAdminUrl') return n.kongAdminUrl.toLowerCase()
    return (n.kongVersion || '').toLowerCase()
  }
})

function formatCreated(value?: string) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function isActive(id: string) {
  return user.value?.activeNodeId === id
}

async function load() {
  error.value = ''
  try {
    const res = await $fetch<{ data: NodeRow[] }>('/api/nodes')
    nodes.value = (res.data || []).map((n) => ({ ...n, healthy: null, kongVersion: undefined }))
    await Promise.all(nodes.value.map((n) => probe(n.id, false)))
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Failed to load connections'
  }
}

async function probe(id: string, notify = true) {
  const row = nodes.value.find((n) => n.id === id)
  if (!row) return
  row.checking = true
  try {
    const res = await $fetch<{ ok: boolean; info?: { version?: string } }>(`/api/nodes/${id}/test`, {
      method: 'POST'
    })
    row.healthy = true
    row.kongVersion = res.info?.version || '—'
    if (notify) useNotify().success(`Connection OK — Kong ${row.kongVersion}`)
  } catch (e: any) {
    row.healthy = false
    row.kongVersion = '—'
    if (notify) useNotify().error(e?.data?.statusMessage || 'Connection failed')
  } finally {
    row.checking = false
  }
}

async function toggleActive(id: string) {
  try {
    if (isActive(id)) {
      await $fetch('/api/nodes/deactivate', { method: 'POST' })
      await refresh()
      useNotify().success('Connection deactivated')
    } else {
      await $fetch(`/api/nodes/${id}/activate`, { method: 'POST' })
      await refresh()
      useNotify().success('Connection activated')
    }
    await refreshConnectionNodes().catch(() => {})
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Failed to update active connection')
  }
}

async function remove(id: string) {
  if (!confirm('Delete this connection?')) return
  try {
    await $fetch(`/api/nodes/${id}`, { method: 'DELETE' })
    useNotify().success('Connection deleted')
    await refreshConnectionNodes().catch(() => {})
    await load()
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Delete failed')
  }
}

async function toggleHealthChecks(n: NodeRow) {
  if (user.value?.role !== 'admin') return
  try {
    const res = await $fetch<{ data: NodeRow }>(`/api/nodes/${n.id}`, {
      method: 'PATCH',
      body: { healthChecks: !n.healthChecks }
    })
    n.healthChecks = res.data.healthChecks
    n.healthCheckDetails = res.data.healthCheckDetails
    useNotify().success(n.healthChecks ? 'Health checks enabled' : 'Health checks disabled')
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Failed to update health checks')
  }
}

function healthTitle(n: NodeRow) {
  if (!n.healthChecks) return 'Health checks off — click to enable'
  const d = n.healthCheckDetails
  const parts = [
    'Health checks ON',
    d?.last_checked ? `last check: ${d.last_checked}` : null,
    d?.last_failed ? `last fail: ${d.last_failed}` : null,
    d?.last_success ? `last ok: ${d.last_success}` : null
  ].filter(Boolean)
  return parts.join('\n')
}

function onCreated() {
  showCreate.value = false
  refreshConnectionNodes().catch(() => {})
  load()
}

function onUpdated() {
  editing.value = null
  refreshConnectionNodes().catch(() => {})
  load()
  refresh()
}

function openEdit(n: NodeRow) {
  if (user.value?.role !== 'admin') return
  editing.value = n
}

onMounted(() => {
  restore()
  load()
})
</script>

<template>
  <div class="stack">
    <div>
      <h1 style="margin: 0">Connections</h1>
      <p class="muted" style="margin: 0.5rem 0 0; max-width: 52rem">
        Create connections to Kong Nodes and activate the one you want use.
      </p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="row" style="justify-content: space-between">
      <button
        v-if="user?.role === 'admin'"
        class="btn btn-primary"
        type="button"
        @click="showCreate = true"
      >
        + New Connection
      </button>
      <span v-else />
      <div class="row">
        <input v-model="search" class="input" style="width: 220px" type="search" placeholder="search..." />
        <span class="muted">Results: {{ filtered.length }}</span>
      </div>
    </div>

    <div class="card" style="overflow-x: auto">
      <table class="table">
        <thead>
          <tr>
            <th style="width: 1%" />
            <th style="width: 1%" />
            <th class="th-upper">
              <button class="sort-btn" type="button" @click="toggleSort('name')">
                Name
                <span v-if="sortArrow('name')" aria-hidden="true">{{ sortArrow('name') }}</span>
              </button>
            </th>
            <th class="th-upper">
              <button class="sort-btn" type="button" @click="toggleSort('authType')">
                Type
                <span v-if="sortArrow('authType')" aria-hidden="true">{{ sortArrow('authType') }}</span>
              </button>
            </th>
            <th class="th-upper">
              <button class="sort-btn" type="button" @click="toggleSort('kongAdminUrl')">
                Kong Admin URL
                <span v-if="sortArrow('kongAdminUrl')" aria-hidden="true">{{ sortArrow('kongAdminUrl') }}</span>
              </button>
            </th>
            <th class="th-upper">
              <button class="sort-btn" type="button" @click="toggleSort('kongVersion')">
                Kong Version
                <span v-if="sortArrow('kongVersion')" aria-hidden="true">{{ sortArrow('kongVersion') }}</span>
              </button>
            </th>
            <th class="th-upper">
              <button class="sort-btn" type="button" @click="toggleSort('created')">
                Created
                <span v-if="sortArrow('created')" aria-hidden="true">{{ sortArrow('created') }}</span>
              </button>
            </th>
            <th style="width: 1%" />
            <th style="width: 1%" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="n in paged" :key="n.id">
            <td>
              <button
                class="icon-action"
                type="button"
                :class="{ on: isActive(n.id) }"
                title="Toggle active"
                @click="toggleActive(n.id)"
              >
                <UiIcon :name="isActive(n.id) ? 'lan-connect' : 'lan-disconnect'" />
              </button>
            </td>
            <td>
              <button
                class="icon-action"
                type="button"
                :class="{
                  on: n.healthChecks && n.healthy !== false,
                  danger: n.healthChecks && n.healthy === false
                }"
                :title="healthTitle(n)"
                @click="user?.role === 'admin' ? toggleHealthChecks(n) : probe(n.id)"
                @contextmenu.prevent="probe(n.id)"
              >
                <span v-if="n.checking" class="spin">…</span>
                <UiIcon
                  v-else
                  :name="n.healthChecks ? (n.healthy === false ? 'heart-outline' : 'heart') : 'heart-outline'"
                />
              </button>
            </td>
            <td>
              <button
                v-if="user?.role === 'admin'"
                class="plugin-name-btn"
                type="button"
                @click="openEdit(n)"
              >
                <strong>{{ n.name }}</strong>
              </button>
              <strong v-else>{{ n.name }}</strong>
            </td>
            <td>{{ n.authType || 'default' }}</td>
            <td class="mono-id">{{ n.kongAdminUrl }}</td>
            <td>{{ n.kongVersion || '—' }}</td>
            <td class="text-nowrap">{{ formatCreated(n.createdAt) }}</td>
            <td>
              <button
                class="btn btn-activate"
                :class="{ 'btn-primary': isActive(n.id) }"
                type="button"
                @click="toggleActive(n.id)"
              >
                {{ isActive(n.id) ? 'Deactivate' : 'Activate' }}
              </button>
            </td>
            <td>
              <button
                v-if="user?.role === 'admin'"
                class="btn-link-danger"
                type="button"
                @click="remove(n.id)"
              >
                <UiIcon name="delete" :size="16" />
                Delete
              </button>
            </td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="9" class="muted" style="text-align: center; padding: 1.5rem">
              No connections found...
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ListPagination
      :from="pageRange.from"
      :to="pageRange.to"
      :total="filtered.length"
      :page="page"
      :total-pages="totalPages"
      :page-size="pageSize"
      @update:page="goToPage"
      @update:page-size="setPageSize"
    />

    <CreateConnectionModal v-if="showCreate" @close="showCreate = false" @created="onCreated" />
    <EditConnectionModal
      v-if="editing"
      :node="editing"
      @close="editing = null"
      @updated="onUpdated"
    />
  </div>
</template>
