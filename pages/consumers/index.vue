<script setup lang="ts">
import CreateConsumerModal from '~/components/consumers/CreateConsumerModal.vue'
import UiIcon from '~/components/UiIcon.vue'

type KongConsumer = {
  id: string
  username?: string | null
  custom_id?: string | null
  tags?: string[] | null
  created_at?: number
  [key: string]: unknown
}

type SortKey = 'username' | 'custom_id' | 'tags' | 'created_at'

const { kongFetch } = useKong()
const items = ref<KongConsumer[]>([])
const error = ref('')
const showCreate = ref(false)
const rawItem = ref<KongConsumer | null>(null)

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
} = useListTable<KongConsumer, SortKey>({
  key: 'consumers',
  items,
  defaultSortKey: 'created_at',
  defaultSortDesc: true,
  descKeys: ['created_at'],
  match: (c, q) => {
    const hay = [c.username, c.custom_id, c.id, ...(c.tags || [])].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  },
  sortValue: (c, key) => {
    switch (key) {
      case 'username':
        return (c.username || '').toLowerCase()
      case 'custom_id':
        return (c.custom_id || '').toLowerCase()
      case 'tags':
        return (c.tags || []).join(',').toLowerCase()
      case 'created_at':
        return c.created_at || 0
    }
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
    const res = await kongFetch<{ data: KongConsumer[] }>('consumers', { query: { size: 1000 } })
    items.value = res.data || []
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Failed to load consumers'
  }
}

async function remove(id: string) {
  if (!confirm('Delete consumer?')) return
  try {
    await kongFetch(`consumers/${id}`, { method: 'DELETE' })
    useNotify().success('Consumer deleted')
    await load()
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Delete failed')
  }
}

async function onCreated(consumer: { id: string }) {
  showCreate.value = false
  await navigateTo(`/consumers/${consumer.id}`)
}

onMounted(() => {
  restore()
  load()
})
</script>

<template>
  <div class="stack">
    <div>
      <h1 style="margin: 0">Consumers</h1>
      <p class="muted" style="margin: 0.5rem 0 0; max-width: 52rem">
        The Consumer object represents a consumer — or a user — of an API. You can either rely on Kong as the primary
        datastore, or you can map the consumer list with your database to keep consistency between Kong and your
        existing primary datastore.
      </p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="row" style="justify-content: space-between">
      <button class="btn btn-primary" type="button" @click="showCreate = true">+ Create consumer</button>
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
              <button class="sort-btn" type="button" @click="toggleSort('username')">
                Username
                <span v-if="sortArrow('username')" aria-hidden="true">{{ sortArrow('username') }}</span>
              </button>
            </th>
            <th class="th-upper">
              <button class="sort-btn" type="button" @click="toggleSort('custom_id')">
                Custom_id
                <span v-if="sortArrow('custom_id')" aria-hidden="true">{{ sortArrow('custom_id') }}</span>
              </button>
            </th>
            <th class="th-upper">
              <button class="sort-btn" type="button" @click="toggleSort('tags')">
                Tags
                <span v-if="sortArrow('tags')" aria-hidden="true">{{ sortArrow('tags') }}</span>
              </button>
            </th>
            <th class="th-upper">
              <button class="sort-btn" type="button" @click="toggleSort('created_at')">
                Created
                <span v-if="sortArrow('created_at')" aria-hidden="true">{{ sortArrow('created_at') }}</span>
              </button>
            </th>
            <th style="width: 1%" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in paged" :key="c.id">
            <td>
              <button class="icon-action raw" type="button" title="Raw view" @click="rawItem = c">
                <UiIcon name="eye" />
              </button>
            </td>
            <td>
              <NuxtLink :to="`/consumers/${c.id}`" class="plugin-name-btn">
                <strong>{{ c.username || '—' }}</strong>
              </NuxtLink>
            </td>
            <td>
              <NuxtLink :to="`/consumers/${c.id}`" class="plugin-name-btn">
                <strong>{{ c.custom_id || '—' }}</strong>
              </NuxtLink>
            </td>
            <td>
              <div v-if="c.tags?.length" class="tag-list">
                <span v-for="tag in c.tags" :key="tag" class="tag-pill">{{ tag }}</span>
              </div>
              <span v-else class="muted">—</span>
            </td>
            <td class="text-nowrap">{{ formatCreated(c.created_at) }}</td>
            <td>
              <button class="btn-link-danger" type="button" @click="remove(c.id)">
                <UiIcon name="delete" :size="16" />
                Delete
              </button>
            </td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="6" class="muted" style="text-align: center; padding: 1.5rem">No data found...</td>
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

    <CreateConsumerModal v-if="showCreate" @close="showCreate = false" @created="onCreated" />

    <div v-if="rawItem" class="modal-overlay" @click.self="rawItem = null">
      <div class="modal-panel" style="width: min(640px, 100%)">
        <div class="modal-header">
          <h2 style="margin: 0; font-size: 1.1rem">Raw view — {{ rawItem.username || rawItem.id }}</h2>
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
