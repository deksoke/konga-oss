<script setup lang="ts">
import {
  makePluginGroups,
  pluginDisplayName,
  type PluginGroup
} from '~/utils/pluginGroups'
import AddPluginModal from '~/components/plugins/AddPluginModal.vue'

definePageMeta({ layout: 'default' })

type KongPlugin = { id: string; name: string; enabled?: boolean }
type KongInfo = {
  plugins?: {
    available_on_server?: Record<string, boolean> | string[]
  }
}

const { kongFetch } = useKong()
const groups = ref<PluginGroup[]>([])
const activeGroup = ref('Authentication')
const existing = ref<KongPlugin[]>([])
const error = ref('')
const success = ref('')
const loading = ref(true)
const showAlert = ref(true)
const selectedPlugin = ref<{ name: string; description: string } | null>(null)

const active = computed(() => groups.value.find((g) => g.name === activeGroup.value) || null)

const activePlugins = computed(() => {
  if (!active.value) return []
  return Object.entries(active.value.plugins).map(([id, meta]) => ({
    id,
    description: meta.description || 'no description available...',
    isAdded: existing.value.some((p) => p.name === id)
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
    const [info, pluginsRes] = await Promise.all([
      kongFetch<KongInfo>(''),
      kongFetch<{ data: KongPlugin[] }>('plugins', { query: { size: 1000 } })
    ])
    existing.value = pluginsRes.data || []
    const built = makePluginGroups(info.plugins?.available_on_server)
    groups.value = built.filter((g) => Object.keys(g.plugins).length > 0)
    if (!groups.value.some((g) => g.name === activeGroup.value)) {
      activeGroup.value = groups.value[0]?.name || 'Authentication'
    }
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || 'Failed to load plugins catalog'
  } finally {
    loading.value = false
  }
}

function onAddPlugin(name: string, description: string) {
  error.value = ''
  success.value = ''
  selectedPlugin.value = { name, description }
}

async function onPluginCreated() {
  const name = selectedPlugin.value?.name
  selectedPlugin.value = null
  success.value = name ? `Added global plugin: ${name}` : 'Plugin added successfully'
  await load()
}

onMounted(load)
</script>

<template>
  <div class="stack plugins-add">
    <div>
      <h1 style="margin: 0">Add Global Plugins</h1>
      <p class="muted" style="margin: 0.35rem 0 0">
        <NuxtLink to="/plugins">plugins</NuxtLink>
        <span> / add</span>
      </p>
    </div>

    <div v-if="showAlert" class="info-banner">
      <div>
        <strong>Plugins added in this section will be applied Globally.</strong>
        <ul style="margin: 0.4rem 0 0; padding-left: 1.2rem">
          <li>If you need to add plugins to a specific Service or Route, you can do it in the respective section.</li>
          <li>If you need to add plugins to a specific Consumer, you can do it in the respective Consumer's page.</li>
        </ul>
      </div>
      <button class="banner-close" type="button" aria-label="Close" @click="showAlert = false">×</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="ok">{{ success }}</p>

    <div v-if="loading" class="card muted">Loading available plugins…</div>

    <template v-else>
      <div class="plugin-tabs" role="tablist">
        <button
          v-for="g in groups"
          :key="g.name"
          type="button"
          role="tab"
          class="plugin-tab"
          :class="{ active: activeGroup === g.name }"
          :aria-selected="activeGroup === g.name"
          @click="activeGroup = g.name"
        >
          {{ g.name }}
        </button>
      </div>

      <div v-if="active" class="stack">
        <div>
          <h2 style="margin: 0">{{ active.name }}</h2>
          <p class="muted" style="margin: 0.35rem 0 0">{{ active.description }}</p>
        </div>

        <div v-if="!activePlugins.length" class="card muted">No plugins available in this category.</div>

        <div class="plugin-grid">
          <div
            v-for="p in activePlugins"
            :key="p.id"
            class="plugin-card"
            :class="{ 'is-added': p.isAdded }"
          >
            <h3 class="plugin-card-title">{{ pluginDisplayName(p.id) }}</h3>
            <img
              class="plugin-card-icon"
              :src="pluginIconSrc(p.id)"
              :alt="p.id"
              width="72"
              height="72"
              loading="lazy"
              @error="onPluginIconError"
            />
            <p class="plugin-card-desc">{{ p.description }}</p>
            <button
              class="btn btn-primary plugin-card-btn"
              type="button"
              @click="onAddPlugin(p.id, p.description)"
            >
              {{ p.isAdded ? 'Add again' : 'Add Plugin' }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <AddPluginModal
      v-if="selectedPlugin"
      :plugin-name="selectedPlugin.name"
      :description="selectedPlugin.description"
      @close="selectedPlugin = null"
      @created="onPluginCreated"
    />
  </div>
</template>
