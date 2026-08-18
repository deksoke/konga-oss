<script setup lang="ts">
import EditPluginModal from '~/components/plugins/EditPluginModal.vue'
import { basePluginGroups } from '~/utils/pluginGroups'

type KongPlugin = {
  id: string
  name: string
  enabled?: boolean
  created_at?: number
  service?: { id: string } | null
  route?: { id: string } | null
  consumer?: { id: string } | null
  api?: { id: string } | null
  protocols?: string[]
  config?: Record<string, unknown> | null
}

type SortKey = 'name' | 'scope' | 'created'

const { kongFetch } = useKong()
const items = ref<KongPlugin[]>([])
const error = ref('')
const success = ref('')
const selected = ref<KongPlugin | null>(null)

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
} = useListTable<KongPlugin, SortKey>({
  key: 'plugins',
  items,
  defaultSortKey: 'created',
  defaultSortDesc: true,
  descKeys: ['created'],
  match: (p, q) => {
    const hay = [
      p.name,
      pluginScope(p),
      p.service?.id,
      p.route?.id,
      p.api?.id,
      p.consumer?.id,
      p.id
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  },
  sortValue: (p, key) => {
    switch (key) {
      case 'name':
        return p.name.toLowerCase()
      case 'scope':
        return pluginScope(p).toLowerCase()
      case 'created':
        return p.created_at || 0
    }
  }
})

const descriptions = computed(() => {
  const map: Record<string, string> = {}
  for (const group of basePluginGroups()) {
    for (const [id, meta] of Object.entries(group.plugins)) {
      if (meta.description) map[id] = meta.description
    }
  }
  return map
})

function pluginScope(p: KongPlugin) {
  if (p.service) return 'services'
  if (p.route) return 'routes'
  if (p.api) return 'apis'
  return 'global'
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

async function load() {
  error.value = ''
  try {
    const res = await kongFetch<{ data: KongPlugin[] }>('plugins', { query: { size: 1000 } })
    items.value = res.data || []
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Failed to load plugins'
  }
}

async function toggle(plugin: KongPlugin, event: Event) {
  error.value = ''
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
    error.value = e?.data?.statusMessage || 'Failed to update plugin'
    useNotify().error(error.value)
  }
}

async function remove(id: string) {
  if (!confirm('Delete plugin?')) return
  error.value = ''
  try {
    await kongFetch(`plugins/${id}`, { method: 'DELETE' })
    useNotify().success('Plugin deleted')
    await load()
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Delete failed'
    useNotify().error(error.value)
  }
}

function openPlugin(p: KongPlugin) {
  error.value = ''
  success.value = ''
  selected.value = p
}

async function onUpdated() {
  const name = selected.value?.name
  selected.value = null
  success.value = name ? `Updated plugin: ${name}` : 'Plugin updated'
  await load()
}

onMounted(() => {
  restore()
  load()
})
</script>

<template>
  <div class="stack">
    <div>
      <h1 style="margin: 0">Plugins</h1>
      <p class="muted" style="margin: 0.5rem 0 0; max-width: 52rem">
        A Plugin entity represents a plugin configuration that will be executed during the HTTP
        request/response lifecycle, for example authentication, rate-limiting, transformations, logging.
      </p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="ok">{{ success }}</p>

    <div class="row" style="justify-content: space-between">
      <NuxtLink class="btn btn-primary" to="/plugins/add">+ Add global plugins</NuxtLink>
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
            <th style="width: 1%" />
            <th>
              <button class="sort-btn" type="button" @click="toggleSort('name')">
                Name
                <span v-if="sortArrow('name')" aria-hidden="true">{{ sortArrow('name') }}</span>
              </button>
            </th>
            <th>
              <button class="sort-btn" type="button" @click="toggleSort('scope')">
                Scope
                <span v-if="sortArrow('scope')" aria-hidden="true">{{ sortArrow('scope') }}</span>
              </button>
            </th>
            <th>Apply to</th>
            <th>Consumer</th>
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
          <tr v-for="p in paged" :key="p.id" class="plugin-row">
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
                  @change="toggle(p, $event)"
                />
                <span class="toggle-track" aria-hidden="true">
                  <span class="toggle-thumb" />
                </span>
              </label>
            </td>
            <td>
              <button class="plugin-name-btn" type="button" @click="openPlugin(p)">
                <strong>{{ p.name }}</strong>
              </button>
              <div class="muted" style="font-size: 0.75rem">{{ p.id }}</div>
            </td>
            <td>{{ pluginScope(p) }}</td>
            <td>
              <NuxtLink v-if="p.service" :to="`/services/${p.service.id}`" class="mono-id">
                {{ p.service.id }}
              </NuxtLink>
              <NuxtLink v-else-if="p.route" :to="`/routes/${p.route.id}`" class="mono-id">
                {{ p.route.id }}
              </NuxtLink>
              <span v-else-if="p.api" class="mono-id">{{ p.api.id }}</span>
              <span v-else class="muted">All Entrypoints</span>
            </td>
            <td>
              <NuxtLink v-if="p.consumer" :to="`/consumers/${p.consumer.id}`" class="mono-id">
                {{ p.consumer.id }}
              </NuxtLink>
              <span v-else class="muted">All consumers</span>
            </td>
            <td class="text-nowrap">{{ formatCreated(p.created_at) }}</td>
            <td>
              <button class="btn btn-danger" type="button" @click="remove(p.id)">Delete</button>
            </td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="8" class="muted" style="text-align: center; padding: 1.5rem">
              no data found...
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

    <EditPluginModal
      v-if="selected"
      :plugin="selected"
      :description="descriptions[selected.name]"
      @close="selected = null"
      @updated="onUpdated"
    />
  </div>
</template>
