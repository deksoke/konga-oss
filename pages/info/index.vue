<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { user } = useAuth()
const { kongFetch } = useKong()
const info = ref<Record<string, any> | null>(null)
const error = ref('')

async function load() {
  error.value = ''
  info.value = null
  if (!user.value?.activeNodeId) {
    error.value = 'Select an active connection first.'
    return
  }
  try {
    info.value = await kongFetch<Record<string, any>>('')
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || 'Failed to load Kong info'
  }
}

watch(() => user.value?.activeNodeId, load, { immediate: true })
</script>

<template>
  <div class="stack">
    <div>
      <h1 style="margin: 0">Info</h1>
      <p class="muted" style="margin: 0.5rem 0 0">Kong Admin node information for the active connection.</p>
    </div>
    <div v-if="error" class="card error">{{ error }}</div>
    <div v-else-if="info" class="card" style="overflow: auto">
      <pre class="dashboard-json" style="margin: 0">{{ JSON.stringify(info, null, 2) }}</pre>
    </div>
    <div v-else class="card muted">Loading…</div>
  </div>
</template>
