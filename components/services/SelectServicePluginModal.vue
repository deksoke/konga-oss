<script setup lang="ts">
import { makePluginGroups, type PluginGroup } from '~/utils/pluginGroups'

const props = defineProps<{
  serviceId?: string
  routeId?: string
  scope?: 'service' | 'route' | 'consumer' | 'global'
  /** Plugin names already on this entity */
  existingNames?: string[]
}>()

const emit = defineEmits<{
  close: []
  select: [plugin: { name: string; description: string }]
}>()

defineOptions({ name: 'SelectServicePluginModal' })

const { kongFetch } = useKong()
const loading = ref(true)
const error = ref('')
const groups = ref<PluginGroup[]>([])
const activeGroup = ref('Authentication')

const subtitle = computed(() => {
  if (props.scope === 'route' || props.routeId) return 'Plugins selected here will be applied to this route only.'
  if (props.scope === 'consumer') return 'Plugins selected here will be applied to this consumer only.'
  if (props.scope === 'global') return 'Plugins selected here will be applied globally.'
  return 'Plugins selected here will be applied to this service only.'
})

const active = computed(() => groups.value.find((g) => g.name === activeGroup.value) || null)

const plugins = computed(() => {
  if (!active.value) return []
  return Object.entries(active.value.plugins).map(([id, meta]) => ({
    id,
    description: meta.description || 'no description available...',
    isAdded: (props.existingNames || []).includes(id)
  }))
})

function pluginIconSrc(name: string) {
  return `/images/kong/plugins/${name}.png`
}

function onPluginIconError(event: Event) {
  const img = event.target as HTMLImageElement
  if (img.dataset.fallback === '1') return
  img.dataset.fallback = '1'
  img.src = '/images/kong/plugins/kong.svg'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const info = await kongFetch<{ plugins?: { available_on_server?: Record<string, boolean> | string[] } }>('')
    const built = makePluginGroups(info.plugins?.available_on_server)
    groups.value = built.filter((g) => Object.keys(g.plugins).length > 0)
    if (!groups.value.some((g) => g.name === activeGroup.value)) {
      activeGroup.value = groups.value[0]?.name || 'Authentication'
    }
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || 'Failed to load plugins'
  } finally {
    loading.value = false
  }
}

function onOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) emit('close')
}

onMounted(load)
</script>

<template>
  <div class="modal-overlay" @click="onOverlayClick">
    <div class="modal-panel modal-panel-wide" role="dialog" aria-modal="true" aria-label="Add Plugin">
      <div class="modal-header">
        <h2 style="margin: 0; text-transform: uppercase; font-size: 1.1rem">Add Plugin</h2>
        <button class="banner-close" type="button" @click="emit('close')">×</button>
      </div>
      <div class="modal-subhead muted">
        {{ subtitle }}
      </div>
      <div class="modal-body">
        <p v-if="error" class="error">{{ error }}</p>
        <div v-if="loading" class="muted">Loading plugins…</div>
        <div v-else class="plugin-picker">
          <aside class="plugin-picker-nav">
            <button
              v-for="g in groups"
              :key="g.name"
              type="button"
              class="plugin-picker-nav-item"
              :class="{ active: activeGroup === g.name }"
              @click="activeGroup = g.name"
            >
              {{ g.name }}
            </button>
          </aside>
          <div class="plugin-picker-main">
            <div v-if="active" class="plugin-picker-intro">
              <strong>{{ active.name }}</strong>
              <p class="muted" style="margin: 0.35rem 0 0">{{ active.description }}</p>
            </div>
            <div class="plugin-picker-grid">
              <div
                v-for="p in plugins"
                :key="p.id"
                class="plugin-picker-card"
                :class="{ added: p.isAdded }"
              >
                <strong class="plugin-picker-name">{{ p.id.split('-').join(' ') }}</strong>
                <img
                  :src="pluginIconSrc(p.id)"
                  :alt="p.id"
                  class="plugin-picker-icon"
                  @error="onPluginIconError"
                />
                <p class="muted plugin-picker-desc">{{ p.description }}</p>
                <button
                  class="btn btn-primary"
                  type="button"
                  style="width: 100%"
                  @click="emit('select', { name: p.id, description: p.description })"
                >
                  Add Plugin
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
