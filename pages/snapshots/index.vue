<script setup lang="ts">
definePageMeta({ layout: 'default' })

type SnapshotRow = {
  id: string
  name: string
  kongNodeName: string
  kongNodeUrl: string
  kongVersion: string
  createdAt: string
}

type ScheduleRow = {
  id: string
  cron: string
  active: boolean
  lastRunAt: string | null
  createdAt: string
  connection: { id: string; name: string; kongAdminUrl: string }
}

type SnapshotSortKey = 'name' | 'node' | 'created'
type ScheduleSortKey = 'connection' | 'cron' | 'created'

const TAB_KEY = 'konga:snapshots:tab'

const { user } = useAuth()
const tab = useState<'list' | 'scheduled'>('snapshots-tab', () => 'list')
const snapshots = ref<SnapshotRow[]>([])
const schedules = ref<ScheduleRow[]>([])
const connections = ref<Array<{ id: string; name: string; kongAdminUrl?: string }>>([])
const error = ref('')
const showTake = ref(false)
const showSchedule = ref(false)
const takeName = ref('')
const taking = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const activeNode = computed(() => {
  const id = user.value?.activeNodeId
  if (!id) return null
  return connections.value.find((c) => c.id === id) || null
})

const {
  search,
  pageSize,
  page,
  filtered: filteredSnapshots,
  paged: pagedSnapshots,
  totalPages: snapshotTotalPages,
  pageRange: snapshotPageRange,
  toggleSort: toggleSnapshotSort,
  sortArrow: snapshotSortArrow,
  goToPage: goToSnapshotPage,
  setPageSize: setSnapshotPageSize,
  restore: restoreSnapList
} = useListTable<SnapshotRow, SnapshotSortKey>({
  key: 'snapshots',
  items: snapshots,
  defaultSortKey: 'created',
  defaultSortDesc: true,
  descKeys: ['created'],
  match: (s, q) => [s.name, s.kongNodeName, s.kongVersion].join(' ').toLowerCase().includes(q),
  sortValue: (s, key) => {
    if (key === 'created') return s.createdAt ? new Date(s.createdAt).getTime() : 0
    if (key === 'node') return (s.kongNodeName || '').toLowerCase()
    return (s.name || '').toLowerCase()
  }
})

const {
  search: scheduleSearch,
  pageSize: schedulePageSize,
  page: schedulePage,
  filtered: filteredSchedules,
  paged: pagedSchedules,
  totalPages: scheduleTotalPages,
  pageRange: schedulePageRange,
  toggleSort: toggleScheduleSort,
  sortArrow: scheduleSortArrow,
  goToPage: goToSchedulePage,
  setPageSize: setSchedulePageSize,
  restore: restoreScheduleList
} = useListTable<ScheduleRow, ScheduleSortKey>({
  key: 'snapshot-schedules',
  items: schedules,
  defaultSortKey: 'created',
  defaultSortDesc: true,
  descKeys: ['created'],
  match: (item, q) =>
    [item.connection.name, item.cron].filter(Boolean).join(' ').toLowerCase().includes(q),
  sortValue: (item, key) => {
    if (key === 'created') return item.createdAt ? new Date(item.createdAt).getTime() : 0
    if (key === 'connection') return (item.connection.name || '').toLowerCase()
    return (item.cron || '').toLowerCase()
  }
})

const cronForm = reactive({
  minute: '0',
  hour: '*',
  dayOfMonth: '*',
  month: '*',
  dayOfWeek: '*',
  connectionId: '',
  active: true
})

const cronString = computed(
  () =>
    `${cronForm.minute || '*'} ${cronForm.hour || '*'} ${cronForm.dayOfMonth || '*'} ${cronForm.month || '*'} ${cronForm.dayOfWeek || '*'}`
)

function prettyCron(cron: string) {
  const parts = cron.trim().split(/\s+/)
  if (parts.length < 5) return cron
  const [m, h, dom, mon, dow] = parts
  if (m !== '*' && h === '*' && dom === '*' && mon === '*' && dow === '*') {
    return `Every hour at minute ${m}`
  }
  if (m !== '*' && h !== '*' && dom === '*' && mon === '*' && dow === '*') {
    return `Every day at ${h.padStart(2, '0')}:${m.padStart(2, '0')}`
  }
  return cron
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function loadSnapshots() {
  const res = await $fetch<{ data: SnapshotRow[] }>('/api/snapshots')
  snapshots.value = res.data || []
}

async function loadSchedules() {
  const res = await $fetch<{ data: ScheduleRow[] }>('/api/snapshot-schedules')
  schedules.value = res.data || []
}

async function loadConnections() {
  const res = await $fetch<{ data: Array<{ id: string; name: string; kongAdminUrl: string }> }>(
    '/api/nodes'
  )
  connections.value = res.data || []
}

async function openTakeModal() {
  takeName.value = ''
  try {
    await loadConnections()
  } catch {
    /* still open modal; active node may be missing */
  }
  showTake.value = true
}

async function load() {
  error.value = ''
  try {
    await Promise.all([loadSnapshots(), loadSchedules(), loadConnections()])
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Failed to load snapshots'
  }
}

function setTab(next: 'list' | 'scheduled') {
  tab.value = next
  if (import.meta.client) sessionStorage.setItem(TAB_KEY, next)
}

async function takeSnapshot() {
  if (!user.value?.activeNodeId) {
    useNotify().error('Select an active Kong connection first')
    return
  }
  taking.value = true
  try {
    await $fetch('/api/snapshots/take', {
      method: 'POST',
      body: { name: takeName.value || undefined }
    })
    useNotify().success('Snapshot created')
    showTake.value = false
    takeName.value = ''
    await loadSnapshots()
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Snapshot failed')
  } finally {
    taking.value = false
  }
}

async function removeSnapshot(s: SnapshotRow) {
  if (!confirm('Are you sure you want to delete this snapshot?')) return
  try {
    await $fetch(`/api/snapshots/${s.id}`, { method: 'DELETE' })
    useNotify().success('Snapshot deleted')
    await loadSnapshots()
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Delete failed')
  }
}

function importSnapshot() {
  fileInput.value?.click()
}

async function onFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const text = await file.text()
    const json = JSON.parse(text)
    const data = json.data || json
    const name = json.name || `import@${Date.now()}`
    await $fetch('/api/snapshots/import', {
      method: 'POST',
      body: {
        name,
        kongNodeName: json.kong_node_name || json.kongNodeName || 'imported',
        kongNodeUrl: json.kong_node_url || json.kongNodeUrl || '',
        kongVersion: json.kong_version || json.kongVersion || '',
        data
      }
    })
    useNotify().success('Snapshot imported')
    await loadSnapshots()
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || e?.message || 'Import failed')
  }
}

async function createSchedule() {
  if (!cronForm.connectionId) {
    useNotify().error('Select a connection')
    return
  }
  try {
    await $fetch('/api/snapshot-schedules', {
      method: 'POST',
      body: {
        cron: cronString.value,
        connectionId: cronForm.connectionId,
        active: cronForm.active
      }
    })
    useNotify().success('Schedule created')
    showSchedule.value = false
    await loadSchedules()
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Failed to create schedule')
  }
}

async function toggleActive(item: ScheduleRow) {
  try {
    await $fetch(`/api/snapshot-schedules/${item.id}`, {
      method: 'PATCH',
      body: { active: !item.active }
    })
    await loadSchedules()
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Update failed')
  }
}

async function removeSchedule(item: ScheduleRow) {
  if (!confirm('Delete this schedule?')) return
  try {
    await $fetch(`/api/snapshot-schedules/${item.id}`, { method: 'DELETE' })
    useNotify().success('Schedule deleted')
    await loadSchedules()
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Delete failed')
  }
}

onMounted(() => {
  if (import.meta.client) {
    const saved = sessionStorage.getItem(TAB_KEY)
    if (saved === 'list' || saved === 'scheduled') tab.value = saved
  }
  restoreSnapList()
  restoreScheduleList()
  load()
})
</script>

<template>
  <div class="stack">
    <div>
      <h1 style="margin: 0">Snapshots</h1>
      <p class="muted" style="margin: 0.5rem 0 0">
        Capture and restore Kong Admin configuration snapshots.
      </p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="snap-layout">
      <aside class="snap-nav card" style="padding: 0.75rem">
        <button
          class="nav-pill"
          type="button"
          :class="{ active: tab === 'list' }"
          @click="setTab('list')"
        >
          <UiIcon name="list" :size="18" />
          List
        </button>
        <button
          class="nav-pill"
          type="button"
          :class="{ active: tab === 'scheduled' }"
          @click="setTab('scheduled')"
        >
          <UiIcon name="calendar" :size="18" />
          Scheduled tasks
        </button>
      </aside>

      <div class="stack">
        <template v-if="tab === 'list'">
          <div class="row" style="justify-content: space-between">
            <div class="row">
              <button class="btn-link-accent" type="button" @click="openTakeModal">
                <UiIcon name="camera" :size="18" />
                Instant snapshot
              </button>
              <button class="btn-link-warning" type="button" @click="importSnapshot">
                <UiIcon name="upload" :size="18" />
                Import from file
              </button>
              <input ref="fileInput" class="hidden" type="file" accept="application/json,.json" @change="onFile" />
            </div>
            <div class="row">
              <input v-model="search" class="input" style="width: 220px" type="search" placeholder="search..." />
              <span class="muted">Results: {{ filteredSnapshots.length }}</span>
            </div>
          </div>

          <div class="card" style="overflow-x: auto">
            <table class="table">
              <thead>
                <tr>
                  <th class="th-upper">
                    <button class="sort-btn" type="button" @click="toggleSnapshotSort('name')">
                      Name
                      <span v-if="snapshotSortArrow('name')" aria-hidden="true">{{ snapshotSortArrow('name') }}</span>
                    </button>
                  </th>
                  <th class="th-upper">
                    <button class="sort-btn" type="button" @click="toggleSnapshotSort('node')">
                      Node
                      <span v-if="snapshotSortArrow('node')" aria-hidden="true">{{ snapshotSortArrow('node') }}</span>
                    </button>
                  </th>
                  <th class="th-upper">
                    <button class="sort-btn" type="button" @click="toggleSnapshotSort('created')">
                      Created
                      <span v-if="snapshotSortArrow('created')" aria-hidden="true">{{ snapshotSortArrow('created') }}</span>
                    </button>
                  </th>
                  <th />
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in pagedSnapshots" :key="s.id">
                  <td><strong>{{ s.name }}</strong></td>
                  <td>
                    {{ s.kongNodeName }}
                    <div>
                      <span class="tag">v{{ (s.kongVersion || '').split('-').join('.') || '—' }}</span>
                    </div>
                  </td>
                  <td>{{ formatDate(s.createdAt) }}</td>
                  <td>
                    <NuxtLink class="btn-link-edit" :to="`/snapshots/${s.id}`">
                      <UiIcon name="info" :size="16" />
                      Details
                    </NuxtLink>
                  </td>
                  <td>
                    <button class="btn-link-danger" type="button" @click="removeSnapshot(s)">
                      <UiIcon name="delete" :size="16" />
                      Delete
                    </button>
                  </td>
                </tr>
                <tr v-if="!filteredSnapshots.length">
                  <td colspan="5" class="muted" style="text-align: center">No snapshots found...</td>
                </tr>
              </tbody>
            </table>
          </div>

          <ListPagination
            :from="snapshotPageRange.from"
            :to="snapshotPageRange.to"
            :total="filteredSnapshots.length"
            :page="page"
            :total-pages="snapshotTotalPages"
            :page-size="pageSize"
            @update:page="goToSnapshotPage"
            @update:page-size="setSnapshotPageSize"
          />
        </template>

        <template v-else>
          <div class="row" style="justify-content: space-between">
            <button class="btn-link-accent" type="button" @click="showSchedule = true">
              <UiIcon name="calendar" :size="18" />
              Add schedule
            </button>
            <div class="row">
              <input
                v-model="scheduleSearch"
                class="input"
                style="width: 220px"
                type="search"
                placeholder="search..."
              />
              <span class="muted">Results: {{ filteredSchedules.length }}</span>
            </div>
          </div>
          <div class="card" style="overflow-x: auto">
            <table class="table">
              <thead>
                <tr>
                  <th style="width: 1%" />
                  <th class="th-upper">
                    <button class="sort-btn" type="button" @click="toggleScheduleSort('connection')">
                      Connection
                      <span v-if="scheduleSortArrow('connection')" aria-hidden="true">{{ scheduleSortArrow('connection') }}</span>
                    </button>
                  </th>
                  <th class="th-upper">
                    <button class="sort-btn" type="button" @click="toggleScheduleSort('cron')">
                      Cron
                      <span v-if="scheduleSortArrow('cron')" aria-hidden="true">{{ scheduleSortArrow('cron') }}</span>
                    </button>
                  </th>
                  <th class="th-upper">
                    <button class="sort-btn" type="button" @click="toggleScheduleSort('created')">
                      Created
                      <span v-if="scheduleSortArrow('created')" aria-hidden="true">{{ scheduleSortArrow('created') }}</span>
                    </button>
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in pagedSchedules" :key="item.id">
                  <td>
                    <button
                      class="status-dot"
                      type="button"
                      :title="item.active ? 'Running' : 'Inactive'"
                      :class="item.active ? 'on' : 'off'"
                      @click="toggleActive(item)"
                    />
                  </td>
                  <td><strong>{{ item.connection.name }}</strong></td>
                  <td>{{ prettyCron(item.cron) }}</td>
                  <td>{{ formatDate(item.createdAt) }}</td>
                  <td>
                    <button class="btn-link-danger" type="button" @click="removeSchedule(item)">
                      <UiIcon name="delete" :size="16" />
                      Delete
                    </button>
                  </td>
                </tr>
                <tr v-if="!filteredSchedules.length">
                  <td colspan="5" class="muted" style="text-align: center">No items found...</td>
                </tr>
              </tbody>
            </table>
          </div>

          <ListPagination
            :from="schedulePageRange.from"
            :to="schedulePageRange.to"
            :total="filteredSchedules.length"
            :page="schedulePage"
            :total-pages="scheduleTotalPages"
            :page-size="schedulePageSize"
            @update:page="goToSchedulePage"
            @update:page-size="setSchedulePageSize"
          />
        </template>
      </div>
    </div>

    <div v-if="showTake" class="modal-overlay" @click.self="showTake = false">
      <div class="modal-panel take-snap-panel" role="dialog" aria-modal="true" aria-label="Snapshot">
        <div class="modal-header take-snap-header">
          <h2 class="take-snap-title">Snapshot</h2>
          <button class="banner-close" type="button" @click="showTake = false">×</button>
        </div>

        <table class="take-snap-node">
          <thead>
            <tr>
              <th colspan="2">Active node</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">name</th>
              <td>
                <strong v-if="activeNode" class="take-snap-node-name">{{ activeNode.name }}</strong>
                <span v-else class="error">No active connection</span>
              </td>
            </tr>
            <tr>
              <th scope="row">URL</th>
              <td class="mono-id">{{ activeNode?.kongAdminUrl || '—' }}</td>
            </tr>
          </tbody>
        </table>

        <div class="modal-body take-snap-body stack">
          <p v-if="!user?.activeNodeId" class="error" style="margin: 0">
            Select an active Kong connection from the top bar before taking a snapshot.
          </p>
          <input
            v-model="takeName"
            class="input take-snap-input"
            placeholder="Give the snapshot a unique name..."
            :disabled="!user?.activeNodeId"
            @keydown.enter="takeSnapshot"
          />
          <button
            class="btn btn-primary take-snap-go"
            type="button"
            :disabled="taking || !user?.activeNodeId"
            @click="takeSnapshot"
          >
            {{ taking ? 'Taking…' : 'Go!' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showSchedule" class="modal-overlay" @click.self="showSchedule = false">
      <div class="modal-panel" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2 style="margin: 0; font-size: 1.1rem">New Schedule</h2>
          <button class="banner-close" type="button" @click="showSchedule = false">×</button>
        </div>
        <div class="modal-body stack">
          <p class="muted" style="margin: 0">Schedule snapshots with cron fields (minute hour day month weekday).</p>
          <div class="cron-grid">
            <div>
              <input v-model="cronForm.minute" class="input" placeholder="Minute*" />
              <p class="muted small">Minute</p>
            </div>
            <div>
              <input v-model="cronForm.hour" class="input" placeholder="Hour*" />
              <p class="muted small">Hour</p>
            </div>
            <div>
              <input v-model="cronForm.dayOfMonth" class="input" placeholder="Day of Month*" />
              <p class="muted small">Day of Month</p>
            </div>
            <div>
              <input v-model="cronForm.month" class="input" placeholder="Month*" />
              <p class="muted small">Month</p>
            </div>
            <div>
              <input v-model="cronForm.dayOfWeek" class="input" placeholder="Day of Week*" />
              <p class="muted small">Day of Week</p>
            </div>
          </div>
          <p class="muted" style="margin: 0">Will run @ {{ prettyCron(cronString) }}</p>
          <div>
            <label class="label">Kong connection</label>
            <select v-model="cronForm.connectionId" class="select">
              <option value="">— Please select a connection —</option>
              <option v-for="c in connections" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <label class="row" style="gap: 0.5rem">
            <input v-model="cronForm.active" type="checkbox" />
            <span>Start immediately</span>
          </label>
          <button class="btn btn-primary" type="button" @click="createSchedule">Create schedule</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.snap-layout {
  display: grid;
  grid-template-columns: 12rem 1fr;
  gap: 1rem;
}
.snap-nav {
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
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font: inherit;
}
.nav-pill.active {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}
.nav-pill.active :deep(.ui-icon) {
  color: #fff;
}
.tag {
  display: inline-block;
  margin-top: 0.25rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: color-mix(in srgb, var(--danger) 15%, transparent);
  color: var(--danger);
  font-size: 0.75rem;
}
.status-dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  border: 0;
  cursor: pointer;
}
.status-dot.on {
  background: var(--ok);
}
.status-dot.off {
  background: var(--danger);
}
.cron-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}
.small {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
}
.hidden {
  display: none;
}
.take-snap-panel {
  width: min(440px, 100%);
}
.take-snap-header {
  border-bottom-color: var(--accent);
}
.take-snap-title {
  margin: 0;
  font-size: 1.05rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--accent-strong);
}
.take-snap-node {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.take-snap-node th,
.take-snap-node td {
  border: 1px solid var(--border);
  padding: 0.55rem 0.75rem;
  text-align: left;
  vertical-align: middle;
}
.take-snap-node thead th {
  background: var(--panel-nav-bg);
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.78rem;
  letter-spacing: 0.03em;
}
.take-snap-node tbody th {
  width: 4.5rem;
  font-weight: 600;
  color: var(--text);
  background: transparent;
}
.take-snap-node-name {
  color: var(--accent-strong);
}
.take-snap-body {
  padding-top: 1rem;
}
.take-snap-go {
  width: 100%;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
}
@media (max-width: 800px) {
  .snap-layout {
    grid-template-columns: 1fr;
  }
}
</style>
