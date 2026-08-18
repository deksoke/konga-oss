<script setup lang="ts">
const props = defineProps<{
  entity: 'services' | 'routes'
  entityId: string
}>()

const items = ref<any[]>([])
const open = ref(false)
const authPlugins = ref<string[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter((c) =>
    [c.username, c.custom_id, c.id, ...(c.plugins || [])].join(' ').toLowerCase().includes(q)
  )
})

function formatCreated(ts?: number) {
  if (!ts) return '—'
  const ms = ts > 1e12 ? ts : ts * 1000
  return new Date(ms).toLocaleString()
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const path =
      props.entity === 'services'
        ? `/api/kong-services/${props.entityId}/consumers`
        : `/api/kong-routes/${props.entityId}/consumers`
    const res = await $fetch<{
      data: any[]
      open?: boolean
      authenticationPlugins?: string[]
    }>(path)
    items.value = res.data || []
    open.value = Boolean(res.open)
    authPlugins.value = res.authenticationPlugins || []
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Failed to load eligible consumers'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.entityId, load)
</script>

<template>
  <div class="stack">
    <div class="entity-panel-title">
      Eligible consumers
      <span class="beta-badge">beta</span>
    </div>
    <p class="muted" style="margin: 0">List of consumers with access, based on ACLs &amp; Auth plugins</p>

    <div v-if="open" class="card muted">
      This {{ entity === 'services' ? 'service' : 'route' }} is neither Access Controlled nor secured with an
      Authentication plugin.
    </div>

    <template v-else>
      <div v-if="authPlugins.length" class="card" style="padding: 0.75rem">
        Authentication plugins:
        <span v-for="p in authPlugins" :key="p" class="tag" style="margin-left: 0.35rem">{{ p }}</span>
      </div>
      <div class="row" style="justify-content: flex-end">
        <input v-model="search" class="input" style="width: 220px" type="search" placeholder="search..." />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <div v-if="loading" class="muted">Loading consumers...</div>
      <div v-else class="card" style="overflow-x: auto">
        <table class="table">
          <thead>
            <tr>
              <th class="th-upper">Username</th>
              <th class="th-upper">Custom_id</th>
              <th class="th-upper">Credentials</th>
              <th class="th-upper">Created</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in filtered" :key="c.id">
              <td>
                <NuxtLink :to="`/consumers/${c.id}`"><strong>{{ c.username || '—' }}</strong></NuxtLink>
              </td>
              <td>{{ c.custom_id || '—' }}</td>
              <td>
                <span v-for="p in c.plugins || []" :key="p" class="tag" style="margin-right: 0.25rem">{{ p }}</span>
                <span v-if="!(c.plugins || []).length" class="muted">—</span>
              </td>
              <td>{{ formatCreated(c.created_at) }}</td>
            </tr>
            <tr v-if="!filtered.length">
              <td colspan="4" class="muted" style="text-align: center">No data found...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tag {
  display: inline-block;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: color-mix(in srgb, var(--danger, #c0392b) 15%, transparent);
  color: var(--danger, #c0392b);
  font-size: 0.75rem;
}
</style>
