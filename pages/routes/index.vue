<script setup lang="ts">
import UiIcon from '~/components/UiIcon.vue'

type KongRoute = {
  id: string
  name?: string | null
  tags?: string[] | null
  hosts?: string[] | null
  paths?: string[] | null
  methods?: string[] | null
  strip_path?: boolean
  preserve_host?: boolean
  service?: { id: string; name?: string } | null
  created_at?: number
}

type SortKey = 'name' | 'tags' | 'hosts' | 'service' | 'paths' | 'created'

const { kongFetch } = useKong()
const items = ref<KongRoute[]>([])
const error = ref('')
const success = ref('')
const rawItem = ref<KongRoute | null>(null)

const {
  search,
  filtered,
  paged,
  pageSize,
  page,
  totalPages,
  pageRange,
  toggleSort,
  sortArrow,
  goToPage,
  setPageSize,
  restore
} = useListTable<KongRoute, SortKey>({
  key: 'routes',
  items,
  defaultSortKey: 'created',
  defaultSortDesc: true,
  descKeys: ['created'],
  match: (r, q) => {
    const hay = [
      r.name,
      r.id,
      r.service?.id,
      r.service?.name,
      ...(r.tags || []),
      ...(r.hosts || []),
      ...(r.paths || [])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  },
  sortValue: (r, key) => {
    switch (key) {
      case 'name':
        return (r.name || r.id || '').toLowerCase()
      case 'tags':
        return (r.tags || []).join(',').toLowerCase()
      case 'hosts':
        return (r.hosts || []).join(',').toLowerCase()
      case 'service':
        return (r.service?.name || r.service?.id || '').toLowerCase()
      case 'paths':
        return (r.paths || []).join(',').toLowerCase()
      case 'created':
        return r.created_at || 0
    }
  }
})

function formatCreated(ts?: number) {
  if (!ts) return '—'
  const ms = ts > 1e12 ? ts : ts * 1000
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

async function load() {
  error.value = ''
  try {
    const res = await kongFetch<{ data: KongRoute[] }>('routes', { query: { size: 1000 } })
    items.value = res.data || []
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Failed to load routes'
  }
}

async function patchFlag(r: KongRoute, field: 'strip_path' | 'preserve_host', value: boolean) {
  const prev = r[field]
  r[field] = value
  try {
    await kongFetch(`routes/${r.id}`, { method: 'PATCH', body: { [field]: value } })
    useNotify().success(field === 'strip_path' ? 'Strip Path updated' : 'Preserve Host updated')
  } catch (e: any) {
    r[field] = prev
    error.value = e?.data?.statusMessage || 'Update failed'
    useNotify().error(error.value)
  }
}

async function remove(id: string) {
  if (!confirm('Delete route?')) return
  try {
    await kongFetch(`routes/${id}`, { method: 'DELETE' })
    useNotify().success('Route deleted')
    await load()
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Delete failed'
    useNotify().error(error.value)
  }
}

onMounted(() => {
  restore()
  load()
})
</script>

<template>
  <div class="stack">
    <div>
      <h1 style="margin: 0">Routes</h1>
      <p class="muted" style="margin: 0.5rem 0 0; max-width: 52rem">
        The Route entities define rules to match client requests. Each Route is associated with a Service, and a
        Service may have multiple Routes associated to it. Every request matching a given Route will be proxied to its
        associated Service.
      </p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="ok">{{ success }}</p>

    <div class="row" style="justify-content: space-between">
      <NuxtLink class="btn" to="/services">
        You can only create routes from a service page →
      </NuxtLink>
      <div class="row">
        <input v-model="search" class="input" style="width: 220px" type="search" placeholder="search..." />
        <span class="muted">Results: {{ filtered.length }}</span>
      </div>
    </div>

    <div class="card" style="overflow-x: auto">
      <table class="table">
        <thead>
          <tr>
            <th style="width: 1%" title="Strip Path">Strip</th>
            <th style="width: 1%" title="Preserve Host">Host</th>
            <th style="width: 1%" />
            <th>
              <button class="sort-btn" type="button" @click="toggleSort('name')">
                Name / ID
                <span v-if="sortArrow('name')" aria-hidden="true">{{ sortArrow('name') }}</span>
              </button>
            </th>
            <th>
              <button class="sort-btn" type="button" @click="toggleSort('tags')">
                Tags
                <span v-if="sortArrow('tags')" aria-hidden="true">{{ sortArrow('tags') }}</span>
              </button>
            </th>
            <th>
              <button class="sort-btn" type="button" @click="toggleSort('hosts')">
                Hosts
                <span v-if="sortArrow('hosts')" aria-hidden="true">{{ sortArrow('hosts') }}</span>
              </button>
            </th>
            <th>
              <button class="sort-btn" type="button" @click="toggleSort('service')">
                Service
                <span v-if="sortArrow('service')" aria-hidden="true">{{ sortArrow('service') }}</span>
              </button>
            </th>
            <th>
              <button class="sort-btn" type="button" @click="toggleSort('paths')">
                Paths
                <span v-if="sortArrow('paths')" aria-hidden="true">{{ sortArrow('paths') }}</span>
              </button>
            </th>
            <th>
              <button class="sort-btn" type="button" @click="toggleSort('created')">
                Created
                <span v-if="sortArrow('created')" aria-hidden="true">{{ sortArrow('created') }}</span>
              </button>
            </th>
            <th style="width: 1%" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in paged" :key="r.id">
            <td>
              <button
                class="icon-action"
                type="button"
                :class="{ on: r.strip_path }"
                title="Strip Path"
                @click="patchFlag(r, 'strip_path', !r.strip_path)"
              >
                <UiIcon name="strip-path" />
              </button>
            </td>
            <td>
              <button
                class="icon-action"
                type="button"
                :class="{ on: r.preserve_host }"
                title="Preserve Host"
                @click="patchFlag(r, 'preserve_host', !r.preserve_host)"
              >
                <UiIcon :name="r.preserve_host ? 'preserve-host' : 'preserve-host-off'" />
              </button>
            </td>
            <td>
              <button class="icon-action raw" type="button" title="Raw view" @click="rawItem = r">
                <UiIcon name="eye" />
              </button>
            </td>
            <td>
              <NuxtLink :to="`/routes/${r.id}`" class="plugin-name-btn">
                <strong>{{ r.name || r.id }}</strong>
              </NuxtLink>
            </td>
            <td>
              <div v-if="r.tags?.length" class="tag-list">
                <span v-for="tag in r.tags" :key="tag" class="tag-pill">{{ tag }}</span>
              </div>
              <span v-else class="muted">—</span>
            </td>
            <td>{{ (r.hosts || []).join(', ') || '—' }}</td>
            <td>
              <NuxtLink v-if="r.service?.id" :to="`/services/${r.service.id}`" class="mono-id">
                {{ r.service.name || r.service.id }}
              </NuxtLink>
              <span v-else>—</span>
            </td>
            <td>{{ (r.paths || []).join(', ') || '—' }}</td>
            <td class="text-nowrap">{{ formatCreated(r.created_at) }}</td>
            <td>
              <div class="row-actions">
                <NuxtLink class="btn btn-edit" :to="`/routes/${r.id}`">Edit</NuxtLink>
                <button class="btn btn-danger" type="button" @click="remove(r.id)">Delete</button>
              </div>
            </td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="10" class="muted" style="text-align: center; padding: 1.5rem">no data found...</td>
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

    <div v-if="rawItem" class="modal-overlay" @click.self="rawItem = null">
      <div class="modal-panel" style="width: min(640px, 100%)">
        <div class="modal-header">
          <h2 style="margin: 0; font-size: 1.1rem">Raw view — {{ rawItem.name || rawItem.id }}</h2>
          <button class="banner-close" type="button" @click="rawItem = null">×</button>
        </div>
        <div class="modal-body">
          <pre class="dashboard-json">{{ JSON.stringify(rawItem, null, 2) }}</pre>
        </div>
        <div class="modal-footer">
          <button class="btn" type="button" @click="rawItem = null">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>
