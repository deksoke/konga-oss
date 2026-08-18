<script setup lang="ts">
import CreateServiceModal from '~/components/services/CreateServiceModal.vue'
import UiIcon from '~/components/UiIcon.vue'

type KongService = {
  id: string
  name?: string | null
  host?: string | null
  protocol?: string | null
  port?: number | null
  path?: string | null
  tags?: string[] | null
  created_at?: number
  [key: string]: unknown
}

type SortKey = 'name' | 'host' | 'tags' | 'created'

const { kongFetch } = useKong()
const items = ref<KongService[]>([])
const error = ref('')
const success = ref('')
const showCreate = ref(false)
const rawItem = ref<KongService | null>(null)

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
} = useListTable<KongService, SortKey>({
  key: 'services',
  items,
  defaultSortKey: 'created',
  defaultSortDesc: true,
  descKeys: ['created'],
  match: (s, q) => {
    const hay = [s.name, s.host, s.protocol, s.id, ...(s.tags || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  },
  sortValue: (s, key) => {
    switch (key) {
      case 'name':
        return (s.name || s.id || '').toLowerCase()
      case 'host':
        return (s.host || '').toLowerCase()
      case 'tags':
        return (s.tags || []).join(',').toLowerCase()
      case 'created':
        return s.created_at || 0
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
    const res = await kongFetch<{ data: KongService[] }>('services', { query: { size: 1000 } })
    const list = res.data || []
    const ids = list.map((s) => s.id).filter(Boolean)
    let extras: Record<string, { description: string }> = {}
    if (ids.length) {
      const extrasRes = await $fetch<{ data: Record<string, { description: string }> }>(
        '/api/service-extras',
        { query: { ids: ids.join(',') } }
      ).catch(() => ({ data: {} }))
      extras = extrasRes.data || {}
    }
    items.value = list.map((s) => ({
      ...s,
      extras: { description: extras[s.id]?.description || '' }
    }))
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Failed to load services'
  }
}

async function remove(id: string) {
  if (!confirm('Delete service?')) return
  error.value = ''
  try {
    await kongFetch(`services/${id}`, { method: 'DELETE' })
    useNotify().success('Service deleted')
    await load()
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Delete failed'
    useNotify().error(error.value)
  }
}

function onCreated() {
  showCreate.value = false
  success.value = 'Service created!'
  load()
}

onMounted(() => {
  restore()
  load()
})
</script>

<template>
  <div class="stack">
    <div>
      <h1 style="margin: 0">Services</h1>
      <p class="muted" style="margin: 0.5rem 0 0; max-width: 52rem">
        Service entities, as the name implies, are abstractions of each of your own upstream services. Examples of
        Services would be a data transformation microservice, a billing API, etc.
      </p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="ok">{{ success }}</p>

    <div class="row" style="justify-content: space-between">
      <button class="btn btn-primary" type="button" @click="showCreate = true">+ Add New Service</button>
      <div class="row">
        <input
          v-model="search"
          class="input"
          style="width: 220px"
          type="search"
          placeholder="search..."
        />
        <span class="muted">Results: {{ filtered.length }}</span>
      </div>
    </div>

    <div class="card" style="overflow-x: auto">
      <table class="table">
        <thead>
          <tr>
            <th style="width: 1%" />
            <th>
              <button class="sort-btn" type="button" @click="toggleSort('name')">
                Name
                <span v-if="sortArrow('name')" aria-hidden="true">{{ sortArrow('name') }}</span>
              </button>
            </th>
            <th>
              <button class="sort-btn" type="button" @click="toggleSort('host')">
                Host
                <span v-if="sortArrow('host')" aria-hidden="true">{{ sortArrow('host') }}</span>
              </button>
            </th>
            <th>
              <button class="sort-btn" type="button" @click="toggleSort('tags')">
                Tags
                <span v-if="sortArrow('tags')" aria-hidden="true">{{ sortArrow('tags') }}</span>
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
          <tr v-for="s in paged" :key="s.id">
            <td>
              <button class="icon-action raw" type="button" title="Raw view" @click="rawItem = s">
                <UiIcon name="eye" />
              </button>
            </td>
            <td>
              <NuxtLink :to="`/services/${s.id}`" class="plugin-name-btn">
                <strong>{{ s.name || '—' }}</strong>
              </NuxtLink>
              <p
                v-if="(s as any).extras?.description"
                class="muted"
                style="margin: 0.2rem 0 0; font-size: 0.8rem"
              >
                {{ (s as any).extras.description }}
              </p>
            </td>
            <td>{{ s.host || '—' }}</td>
            <td>
              <div v-if="s.tags?.length" class="tag-list">
                <span v-for="tag in s.tags" :key="tag" class="tag-pill">{{ tag }}</span>
              </div>
              <span v-else class="muted">—</span>
            </td>
            <td class="text-nowrap">{{ formatCreated(s.created_at) }}</td>
            <td>
              <button class="btn btn-danger" type="button" @click="remove(s.id)">Delete</button>
            </td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="6" class="muted" style="text-align: center; padding: 1.5rem">no data found...</td>
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

    <CreateServiceModal v-if="showCreate" @close="showCreate = false" @created="onCreated" />

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
