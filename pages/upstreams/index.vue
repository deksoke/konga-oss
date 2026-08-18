<script setup lang="ts">
import CreateUpstreamModal from '~/components/upstreams/CreateUpstreamModal.vue'
import UiIcon from '~/components/UiIcon.vue'

type KongUpstream = {
  id: string
  name?: string | null
  slots?: number | null
  tags?: string[] | null
  created_at?: number
  [key: string]: unknown
}

type SortKey = 'name' | 'tags' | 'slots' | 'created'

const { kongFetch } = useKong()
const items = ref<KongUpstream[]>([])
const error = ref('')
const showCreate = ref(false)
const rawItem = ref<KongUpstream | null>(null)

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
} = useListTable<KongUpstream, SortKey>({
  key: 'upstreams',
  items,
  defaultSortKey: 'created',
  defaultSortDesc: true,
  descKeys: ['created'],
  match: (u, q) => {
    const hay = [u.name, u.id, ...(u.tags || [])].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  },
  sortValue: (u, key) => {
    if (key === 'name') return (u.name || '').toLowerCase()
    if (key === 'tags') return (u.tags || []).join(' ').toLowerCase()
    if (key === 'slots') return u.slots ?? -1
    return u.created_at || 0
  }
})

function formatCreated(ts?: number) {
  if (!ts) return '—'
  const ms = ts > 1e12 ? ts : ts * 1000
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function load() {
  error.value = ''
  try {
    const res = await kongFetch<{ data: KongUpstream[] }>('upstreams', { query: { size: 1000 } })
    items.value = res.data || []
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Failed to load upstreams'
  }
}

async function remove(id: string) {
  if (!confirm('Delete upstream?')) return
  try {
    await kongFetch(`upstreams/${id}`, { method: 'DELETE' })
    useNotify().success('Upstream deleted')
    await load()
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Delete failed')
  }
}

function onCreated(upstream: { id: string }) {
  showCreate.value = false
  navigateTo(`/upstreams/${upstream.id}`)
}

onMounted(() => {
  restore()
  load()
})
</script>

<template>
  <div class="stack">
    <div>
      <h1 style="margin: 0">Upstreams</h1>
      <p class="muted" style="margin: 0.5rem 0 0; max-width: 52rem">
        The upstream object represents a virtual hostname and can be used to loadbalance incoming requests over multiple
        services (targets). For example an upstream named <code>service.v1.xyz</code> with a Service
        <code>host=service.v1.xyz</code> will proxy to the targets defined within that upstream.
      </p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="row" style="justify-content: space-between">
      <button class="btn btn-primary" type="button" @click="showCreate = true">+ Create upstream</button>
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
            <th class="th-upper">
              <button class="sort-btn" type="button" @click="toggleSort('name')">
                Name
                <span v-if="sortArrow('name')" aria-hidden="true">{{ sortArrow('name') }}</span>
              </button>
            </th>
            <th class="th-upper">
              <button class="sort-btn" type="button" @click="toggleSort('tags')">
                Tags
                <span v-if="sortArrow('tags')" aria-hidden="true">{{ sortArrow('tags') }}</span>
              </button>
            </th>
            <th class="th-upper">
              <button class="sort-btn" type="button" @click="toggleSort('slots')">
                Slots
                <span v-if="sortArrow('slots')" aria-hidden="true">{{ sortArrow('slots') }}</span>
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
          <tr v-for="u in paged" :key="u.id">
            <td>
              <button class="icon-action raw" type="button" title="Raw view" @click="rawItem = u">
                <UiIcon name="eye" />
              </button>
            </td>
            <td>
              <NuxtLink :to="`/upstreams/${u.id}`" class="plugin-name-btn">
                <strong>{{ u.name || '—' }}</strong>
              </NuxtLink>
            </td>
            <td>
              <div v-if="u.tags?.length" class="tag-list">
                <span v-for="tag in u.tags" :key="tag" class="tag-pill">{{ tag }}</span>
              </div>
              <span v-else class="muted">—</span>
            </td>
            <td>{{ u.slots ?? '—' }}</td>
            <td class="text-nowrap">{{ formatCreated(u.created_at) }}</td>
            <td>
              <NuxtLink class="btn-link-accent" :to="`/upstreams/${u.id}`">Details</NuxtLink>
            </td>
            <td>
              <button class="btn-link-danger" type="button" @click="remove(u.id)">
                <UiIcon name="delete" :size="16" />
                Delete
              </button>
            </td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="7" class="muted" style="text-align: center; padding: 1.5rem">No data found...</td>
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

    <CreateUpstreamModal v-if="showCreate" @close="showCreate = false" @created="onCreated" />

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
