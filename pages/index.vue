<script setup lang="ts">
definePageMeta({ layout: 'default' })

type KongInfo = {
  version?: string
  hostname?: string
  tagline?: string
  lua_version?: string
  timers?: { pending?: number; running?: number }
  plugins?: {
    available_on_server?: Record<string, boolean | object>
    enabled_in_cluster?: string[]
  }
  configuration?: Record<string, any>
}

type KongStatus = {
  server?: {
    connections_active?: number
    connections_reading?: number
    connections_writing?: number
    connections_waiting?: number
    connections_accepted?: number
    connections_handled?: number
    total_requests?: number
  }
  database?: {
    reachable?: boolean
    [key: string]: unknown
  }
}

const { user } = useAuth()
const { kongFetch } = useKong()

const info = ref<KongInfo | null>(null)
const status = ref<KongStatus | null>(null)
const error = ref('')
const loading = ref(false)
const pollIntervalMs = ref(10_000)
let pollTimer: ReturnType<typeof setTimeout> | null = null

function convert2Unit(n?: number | null) {
  if (n == null || Number.isNaN(n)) return '—'
  if (n >= 1_000_000) return `${Math.trunc(n / 1_000_000)}M+`
  if (n >= 1000) return `${Math.trunc(n / 1000)}K+`
  return String(n)
}

function formatValue(value: unknown) {
  if (value == null) return '—'
  if (Array.isArray(value)) return JSON.stringify(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function isEnabled(name: string) {
  const enabled = info.value?.plugins?.enabled_in_cluster || []
  return enabled.includes(name)
}

const pluginNames = computed(() => {
  const available = info.value?.plugins?.available_on_server
  if (!available) return []
  return Object.keys(available).sort()
})

const connectionStats = computed(() => {
  const s = status.value?.server || {}
  return [
    { label: 'Active', value: s.connections_active, title: String(s.connections_active ?? '') },
    { label: 'Reading', value: s.connections_reading, title: String(s.connections_reading ?? '') },
    { label: 'Writing', value: s.connections_writing, title: String(s.connections_writing ?? '') },
    { label: 'Waiting', value: s.connections_waiting, title: String(s.connections_waiting ?? '') },
    { label: 'Accepted', value: s.connections_accepted, title: String(s.connections_accepted ?? '') },
    { label: 'Handled', value: s.connections_handled, title: String(s.connections_handled ?? '') }
  ]
})

const timerBars = computed(() => {
  const pending = info.value?.timers?.pending ?? 0
  const running = info.value?.timers?.running ?? 0
  const max = Math.max(pending, running, 1)
  return [
    { label: 'Pending', value: pending, pct: (pending / max) * 100, tone: 'accent' as const },
    { label: 'Running', value: running, pct: (running / max) * 100, tone: 'muted' as const }
  ]
})

const dbms = computed(() => info.value?.configuration?.database || '—')
const dbReachable = computed(() => status.value?.database?.reachable)

function clearPoll() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

async function load(silent = false) {
  clearPoll()
  error.value = ''
  if (!user.value?.activeNodeId) {
    info.value = null
    status.value = null
    return
  }
  if (!silent) loading.value = true
  try {
    const [infoRes, statusRes] = await Promise.all([
      kongFetch<KongInfo>(''),
      kongFetch<KongStatus>('status')
    ])
    if (!infoRes || typeof infoRes !== 'object' || !('version' in infoRes)) {
      throw new Error(
        'Kong Admin returned an unexpected response. Check the connection URL (Kong Admin API, e.g. http://kong:8001).'
      )
    }
    info.value = infoRes
    status.value = statusRes
    if (pollIntervalMs.value > 0) {
      pollTimer = setTimeout(() => load(true), pollIntervalMs.value)
    }
  } catch (e: any) {
    info.value = null
    status.value = null
    error.value = e?.data?.statusMessage || e?.message || 'Failed to reach Kong'
  } finally {
    loading.value = false
  }
}

async function loadPollInterval() {
  try {
    const res = await $fetch<{ data: { info_polling_interval: number } }>('/api/settings/public')
    const ms = Number(res.data?.info_polling_interval)
    pollIntervalMs.value = Number.isFinite(ms) ? ms : 10_000
  } catch {
    pollIntervalMs.value = 10_000
  }
}

watch(() => user.value?.activeNodeId, () => load(false), { immediate: true })
onMounted(async () => {
  await loadPollInterval()
  if (user.value?.activeNodeId) await load(true)
})
onBeforeUnmount(clearPoll)
</script>

<template>
  <div class="stack dashboard">
    <!-- No active connection -->
    <div v-if="!user?.activeNodeId" class="card dashboard-empty">
      <h2 style="margin: 0 0 0.5rem">Welcome!</h2>
      <p class="muted" style="margin: 0; max-width: 28rem">
        No active connection to Kong Admin was found.<br />
        Activate one from the
        <NuxtLink to="/connections">Connections</NuxtLink>
        page.
      </p>
    </div>

    <template v-else>
      <div v-if="loading && !info" class="card muted">Connecting to node. Please wait…</div>

      <div v-else-if="error" class="card dashboard-empty">
        <h2 style="margin: 0 0 0.5rem">Something went wrong…</h2>
        <p class="muted" style="margin: 0; max-width: 32rem">
          Failed to connect to Kong.<br />
          Make sure your active
          <NuxtLink to="/connections">connection</NuxtLink>
          is valid and Kong is up and running.
        </p>
        <p class="error" style="margin: 0.75rem 0 0">{{ error }}</p>
      </div>

      <template v-else-if="info && status">
        <!-- CONNECTIONS -->
        <section class="card dash-panel">
          <div class="dash-panel-head">
            <h2 class="dash-panel-title">Connections</h2>
            <span class="muted" :title="String(status.server?.total_requests ?? '')">
              Total Requests:
              <strong>{{ convert2Unit(status.server?.total_requests) }}</strong>
            </span>
          </div>
          <div class="dash-conn-grid">
            <div
              v-for="stat in connectionStats"
              :key="stat.label"
              class="dash-conn-stat"
              :title="stat.title"
            >
              <div class="dash-conn-label">{{ stat.label }}</div>
              <div class="dash-conn-value">{{ convert2Unit(stat.value) }}</div>
            </div>
          </div>
        </section>

        <!-- NODE / TIMERS / DATASTORE -->
        <div class="dash-mid-grid">
          <section class="card dash-panel">
            <div class="dash-panel-head">
              <h2 class="dash-panel-title">Node Info</h2>
            </div>
            <table class="dash-kv">
              <tbody>
                <tr>
                  <th>HostName</th>
                  <td>{{ info.hostname || '—' }}</td>
                </tr>
                <tr>
                  <th>Tag Line</th>
                  <td>{{ info.tagline || '—' }}</td>
                </tr>
                <tr>
                  <th>Version</th>
                  <td>{{ info.version || '—' }}</td>
                </tr>
                <tr>
                  <th>LUA Version</th>
                  <td>{{ info.lua_version || '—' }}</td>
                </tr>
                <tr>
                  <th>Admin listen</th>
                  <td>{{ formatValue(info.configuration?.admin_listen) }}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section class="card dash-panel">
            <div class="dash-panel-head">
              <h2 class="dash-panel-title">Timers</h2>
            </div>
            <div class="dash-timers">
              <div v-for="bar in timerBars" :key="bar.label" class="dash-timer-row">
                <div class="dash-timer-label">{{ bar.label }}</div>
                <div class="dash-timer-track">
                  <div
                    class="dash-timer-fill"
                    :class="bar.tone"
                    :style="{ width: `${Math.max(bar.pct, bar.value ? 4 : 0)}%` }"
                    :title="String(bar.value)"
                  />
                </div>
                <div class="dash-timer-value muted">{{ bar.value }}</div>
              </div>
            </div>
          </section>

          <section class="card dash-panel">
            <div class="dash-panel-head">
              <h2 class="dash-panel-title">Datastore Info</h2>
              <span
                v-if="dbReachable != null"
                class="dash-reach"
                :class="dbReachable ? 'ok' : 'bad'"
              >
                {{ dbReachable ? 'Reachable' : 'Unreachable' }}
              </span>
            </div>
            <table class="dash-kv">
              <tbody>
                <tr>
                  <th>DBMS</th>
                  <td>{{ dbms }}</td>
                </tr>
                <template v-if="dbms === 'postgres'">
                  <tr>
                    <th>Host</th>
                    <td>{{ info.configuration?.pg_host || '—' }}</td>
                  </tr>
                  <tr>
                    <th>Database</th>
                    <td>{{ info.configuration?.pg_database || '—' }}</td>
                  </tr>
                  <tr>
                    <th>User</th>
                    <td>{{ info.configuration?.pg_user || '—' }}</td>
                  </tr>
                  <tr>
                    <th>Port</th>
                    <td>{{ info.configuration?.pg_port || '—' }}</td>
                  </tr>
                </template>
                <template v-else-if="dbms === 'cassandra'">
                  <tr v-if="info.configuration?.cassandra_contact_points">
                    <th>Contact points</th>
                    <td>{{ formatValue(info.configuration.cassandra_contact_points) }}</td>
                  </tr>
                  <tr v-if="info.configuration?.cassandra_keyspace">
                    <th>Keyspace</th>
                    <td>{{ info.configuration.cassandra_keyspace }}</td>
                  </tr>
                  <tr>
                    <th>Username</th>
                    <td>{{ info.configuration?.cassandra_username || '—' }}</td>
                  </tr>
                  <tr>
                    <th>Port</th>
                    <td>{{ info.configuration?.cassandra_port || '—' }}</td>
                  </tr>
                </template>
              </tbody>
            </table>
          </section>
        </div>

        <!-- PLUGINS -->
        <section class="card dash-panel">
          <div class="dash-panel-head">
            <h2 class="dash-panel-title">Plugins</h2>
          </div>
          <div class="dash-plugins">
            <span
              v-for="name in pluginNames"
              :key="name"
              class="dash-plugin-tag"
              :class="{ on: isEnabled(name) }"
            >
              {{ name }}
            </span>
            <span v-if="!pluginNames.length" class="muted">No plugins reported by Kong.</span>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>
