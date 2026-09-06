<script setup lang="ts">
import ChipInput from '~/components/plugins/ChipInput.vue'
import AddTargetModal from '~/components/upstreams/AddTargetModal.vue'
import UpstreamDetailsForm, {
  type UpstreamFormModel
} from '~/components/upstreams/UpstreamDetailsForm.vue'
import UiIcon from '~/components/UiIcon.vue'
import {
  buildUpstreamPayload,
  emptyUpstreamForm,
  fillUpstreamForm
} from '~/utils/upstreamForm'

const route = useRoute()
const router = useRouter()
const { kongFetch } = useKong()

type Tab = 'details' | 'targets' | 'alerts'

type KongTarget = {
  id: string
  target?: string
  weight?: number
  health?: string
  created_at?: number
  [key: string]: unknown
}

const upstream = ref<any>(null)
const targets = ref<KongTarget[]>([])
const error = ref('')
const success = ref('')
const saving = ref(false)
const fieldErrors = ref<Record<string, string>>({})
const showAddTarget = ref(false)
const targetSearch = ref('')
const rawTarget = ref<KongTarget | null>(null)
const form = reactive<UpstreamFormModel>(emptyUpstreamForm())
const alert = ref<{ active: boolean; email: boolean; slack: boolean; discord: boolean; line: boolean }>({
  active: false,
  email: false,
  slack: true,
  discord: true,
  line: true
})
const alertSaving = ref(false)

const tab = computed<Tab>(() => {
  const q = String(route.query.tab || 'details')
  if (q === 'targets' || q === 'alerts') return q
  return 'details'
})

const sections = [
  { id: 'details' as Tab, label: 'Details' },
  { id: 'targets' as Tab, label: 'Targets' },
  { id: 'alerts' as Tab, label: 'Alerts' }
]

const filteredTargets = computed(() => {
  const q = targetSearch.value.trim().toLowerCase()
  if (!q) return targets.value
  return targets.value.filter((t) =>
    [t.target, t.id, t.health, String(t.weight ?? '')].join(' ').toLowerCase().includes(q)
  )
})

function setTab(id: Tab) {
  router.replace({ query: { ...route.query, tab: id === 'details' ? undefined : id } })
}

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

function applyForm(next: UpstreamFormModel) {
  Object.assign(form, next)
  form.tags = [...next.tags]
  form.healthchecks = JSON.parse(JSON.stringify(next.healthchecks))
}

async function load() {
  error.value = ''
  try {
    const id = String(route.params.id)
    upstream.value = await kongFetch(`upstreams/${id}`)
    applyForm(fillUpstreamForm(upstream.value))
    await Promise.all([loadTargets(), loadAlert()])
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Failed to load upstream'
  }
}

async function loadAlert() {
  try {
    const res = await $fetch<{
      data: { active: boolean; email: boolean; slack: boolean; discord: boolean; line: boolean }
    }>(`/api/upstream-alerts/${route.params.id}`)
    alert.value = {
      active: Boolean(res.data?.active),
      email: Boolean(res.data?.email),
      slack: res.data?.slack !== false,
      discord: res.data?.discord !== false,
      line: res.data?.line !== false
    }
  } catch {
    alert.value = { active: false, email: false, slack: true, discord: true, line: true }
  }
}

async function saveAlert() {
  alertSaving.value = true
  try {
    const res = await $fetch<{
      data: { active: boolean; email: boolean; slack: boolean; discord: boolean; line: boolean }
    }>(`/api/upstream-alerts/${route.params.id}`, {
      method: 'PUT',
      body: alert.value
    })
    alert.value = {
      active: Boolean(res.data.active),
      email: Boolean(res.data.email),
      slack: Boolean(res.data.slack),
      discord: Boolean(res.data.discord),
      line: Boolean(res.data.line)
    }
    useNotify().success(alert.value.active ? 'Upstream alerts enabled' : 'Upstream alerts disabled')
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Failed to save alerts')
  } finally {
    alertSaving.value = false
  }
}

async function loadTargets() {
  const id = String(route.params.id)
  try {
    const res = await kongFetch<{ data: KongTarget[] }>(`upstreams/${id}/targets`, {
      query: { size: 1000 }
    })
    targets.value = res.data || []
  } catch {
    try {
      const res = await kongFetch<{ data: KongTarget[] }>(`upstreams/${id}/targets/all`, {
        query: { size: 1000 }
      })
      targets.value = res.data || []
    } catch (e: any) {
      targets.value = []
      if (tab.value === 'targets') {
        error.value = e?.data?.statusMessage || 'Failed to load targets'
      }
    }
  }
}

async function updateUpstream() {
  error.value = ''
  success.value = ''
  fieldErrors.value = {}
  if (!form.name.trim()) {
    error.value = 'Name is required.'
    useNotify().error(error.value)
    return
  }
  saving.value = true
  try {
    const body = buildUpstreamPayload(form)
    upstream.value = await kongFetch(`upstreams/${route.params.id}`, { method: 'PATCH', body })
    applyForm(fillUpstreamForm(upstream.value))
    success.value = 'Upstream updated successfully'
    useNotify().success('Upstream updated successfully')
  } catch (e: any) {
    const body = e?.data?.data || e?.data
    if (body?.fields && typeof body.fields === 'object') {
      const next: Record<string, string> = {}
      for (const [k, v] of Object.entries(body.fields)) {
        next[k] = typeof v === 'string' ? v : JSON.stringify(v)
      }
      fieldErrors.value = next
    }
    error.value = body?.message || e?.data?.statusMessage || 'Update failed'
    useNotify().error(error.value)
  } finally {
    saving.value = false
  }
}

async function removeTarget(t: KongTarget) {
  if (!confirm('Delete this target?')) return
  try {
    await kongFetch(`upstreams/${route.params.id}/targets/${t.id}`, { method: 'DELETE' }).catch(() =>
      kongFetch(`targets/${t.id}`, { method: 'DELETE' })
    )
    useNotify().success('Target deleted')
    await loadTargets()
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Failed to delete target')
  }
}

async function setHealth(t: KongTarget, healthy: boolean) {
  const suffix = healthy ? 'healthy' : 'unhealthy'
  try {
    await kongFetch(`upstreams/${route.params.id}/targets/${t.id}/${suffix}`, {
      method: 'PUT',
      body: {}
    })
    useNotify().success(healthy ? 'Target marked healthy' : 'Target marked unhealthy')
    await loadTargets()
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || `Failed to set ${suffix}`)
  }
}

function onTargetCreated() {
  showAddTarget.value = false
  loadTargets()
}

onMounted(load)
watch(() => route.params.id, load)
</script>

<template>
  <div class="stack">
    <div>
      <h1 style="margin: 0">Upstream {{ upstream?.name || upstream?.id || '' }}</h1>
      <p class="muted" style="margin: 0.35rem 0 0">
        <NuxtLink to="/upstreams">upstreams</NuxtLink>
        <span> / edit</span>
      </p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="ok">{{ success }}</p>

    <div v-if="!upstream" class="card muted">Loading…</div>

    <div v-else class="entity-layout">
      <nav class="entity-nav" aria-label="Upstream sections">
        <button
          v-for="s in sections"
          :key="s.id"
          type="button"
          class="entity-nav-item"
          :class="{ active: tab === s.id }"
          @click="setTab(s.id)"
        >
          {{ s.label }}
          <span v-if="(s as any).beta" class="beta-badge">beta</span>
        </button>
      </nav>

      <div class="entity-panel stack">
        <template v-if="tab === 'details'">
          <div class="entity-panel-title">Details</div>
          <UpstreamDetailsForm
            v-model="form"
            :field-errors="fieldErrors"
            :saving="saving"
            submit-label="✓ Submit Changes"
            @submit="updateUpstream"
          />
        </template>

        <template v-else-if="tab === 'targets'">
          <div class="entity-panel-title">Targets</div>
          <p class="field-help" style="margin: 0">
            A target is an IP/hostname with a port that identifies a backend instance. Every upstream can have many
            targets, and they can be dynamically added. Changes take effect on the fly. To disable a target, post a new
            one with <code>weight=0</code>.
          </p>
          <div class="row" style="justify-content: space-between">
            <button class="btn btn-primary" type="button" @click="showAddTarget = true">+ Add target</button>
            <div class="row">
              <input
                v-model="targetSearch"
                class="input"
                style="width: 200px"
                type="search"
                placeholder="search..."
              />
              <span class="muted">{{ filteredTargets.length }}</span>
            </div>
          </div>
          <div class="card" style="overflow-x: auto">
            <table class="table">
              <thead>
                <tr>
                  <th style="width: 1%" />
                  <th style="width: 1%" />
                  <th class="th-upper">Target</th>
                  <th class="th-upper">Weight</th>
                  <th class="th-upper">Created</th>
                  <th style="width: 1%" />
                  <th style="width: 1%" />
                  <th style="width: 1%" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in filteredTargets" :key="t.id">
                  <td>
                    <span
                      v-if="t.health === 'DNS_ERROR'"
                      class="target-health-badge"
                      :title="t.health"
                    >
                      DNS_ERROR
                    </span>
                    <span
                      v-else-if="t.health === 'HEALTHY'"
                      class="target-health is-healthy"
                      :title="t.health"
                    >
                      <UiIcon name="heart-pulse" :size="22" />
                    </span>
                    <span
                      v-else-if="t.health === 'UNHEALTHY'"
                      class="target-health is-unhealthy"
                      :title="t.health"
                    >
                      <UiIcon name="heart-broken" :size="22" />
                    </span>
                    <span
                      v-else-if="t.health === 'HEALTHCHECKS_OFF'"
                      class="target-health is-off"
                      :title="t.health"
                    >
                      <UiIcon name="heart-outline" :size="22" />
                    </span>
                    <span v-else class="muted">—</span>
                  </td>
                  <td>
                    <button class="icon-action raw" type="button" title="Raw view" @click="rawTarget = t">
                      <UiIcon name="eye" />
                    </button>
                  </td>
                  <td class="mono-id">{{ t.target || '—' }}</td>
                  <td>{{ t.weight ?? '—' }}</td>
                  <td class="text-nowrap">{{ formatCreated(t.created_at) }}</td>
                  <td>
                    <button
                      class="btn-link-success"
                      type="button"
                      title="Set healthy"
                      @click="setHealth(t, true)"
                    >
                      <UiIcon name="check-circle" :size="20" />
                    </button>
                  </td>
                  <td>
                    <button
                      class="btn-link-warn"
                      type="button"
                      title="Set unhealthy"
                      @click="setHealth(t, false)"
                    >
                      <UiIcon name="heart-off" :size="20" />
                    </button>
                  </td>
                  <td>
                    <button class="btn btn-danger" type="button" @click="removeTarget(t)">Delete</button>
                  </td>
                </tr>
                <tr v-if="!filteredTargets.length">
                  <td colspan="8" class="muted" style="text-align: center">No data found...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-else-if="tab === 'alerts'">
          <div class="entity-panel-title">Alerts</div>
          <div class="card stack">
            <p class="muted" style="margin: 0">
              Poll upstream target health and notify administrators when targets become UNHEALTHY or DNS_ERROR.
            </p>
            <label class="row" style="gap: 0.5rem">
              <input v-model="alert.active" type="checkbox" />
              <span>Enable health alerts for this upstream</span>
            </label>
            <label class="row" style="gap: 0.5rem">
              <input v-model="alert.slack" type="checkbox" :disabled="!alert.active" />
              <span>Notify via Slack (uses Settings integrations)</span>
            </label>
            <label class="row" style="gap: 0.5rem">
              <input v-model="alert.discord" type="checkbox" :disabled="!alert.active" />
              <span>Notify via Discord (uses Settings integrations)</span>
            </label>
            <label class="row" style="gap: 0.5rem">
              <input v-model="alert.line" type="checkbox" :disabled="!alert.active" />
              <span>Notify via LINE (uses Settings integrations)</span>
            </label>
            <label class="row" style="gap: 0.5rem">
              <input v-model="alert.email" type="checkbox" :disabled="!alert.active" />
              <span>Notify via email (uses Settings default transport)</span>
            </label>
            <button class="btn btn-primary" type="button" :disabled="alertSaving" @click="saveAlert">
              {{ alertSaving ? 'Saving…' : 'Save alerts' }}
            </button>
          </div>
        </template>
      </div>
    </div>

    <AddTargetModal
      v-if="showAddTarget && upstream"
      :upstream-id="String(upstream.id)"
      @close="showAddTarget = false"
      @created="onTargetCreated"
    />

    <div v-if="rawTarget" class="modal-overlay" @click.self="rawTarget = null">
      <div class="modal-panel" style="width: min(640px, 100%)">
        <div class="modal-header">
          <h2 style="margin: 0; font-size: 1.1rem">Raw view — {{ rawTarget.target || rawTarget.id }}</h2>
          <button class="banner-close" type="button" @click="rawTarget = null">×</button>
        </div>
        <div class="modal-body">
          <pre class="dashboard-json">{{ JSON.stringify(rawTarget, null, 2) }}</pre>
        </div>
        <div class="modal-footer">
          <button class="btn" type="button" @click="rawTarget = null">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>
