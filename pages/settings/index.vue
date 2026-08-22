<script setup lang="ts">
import type { Settings } from '~/types/settings'

definePageMeta({ layout: 'default' })

const TABS = [
  { id: 'general', label: 'General settings' },
  { id: 'signup', label: 'Sign up restrictions' },
  { id: 'social', label: 'Social logins' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'permissions', label: 'User permissions' }
] as const

type SettingsTab = (typeof TABS)[number]['id']

const route = useRoute()
const settings = ref<Settings | null>(null)
const error = ref('')
const saving = ref(false)

const tab = computed<SettingsTab>(() => {
  const q = String(route.query.tab || 'general')
  return TABS.some((item) => item.id === q) ? (q as SettingsTab) : 'general'
})

async function load() {
  error.value = ''
  try {
    const res = await $fetch<{ data: Settings }>('/api/settings')
    settings.value = res.data
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Failed to load settings'
  }
}

async function save(partial?: Partial<Settings>) {
  if (!settings.value) return false
  saving.value = true
  try {
    const body = partial ? { ...settings.value, ...partial } : settings.value
    if (typeof body.info_polling_interval !== 'number' || Number.isNaN(body.info_polling_interval)) {
      body.info_polling_interval = 5000
    }
    const res = await $fetch<{ data: Settings }>('/api/settings', {
      method: 'PUT',
      body
    })
    settings.value = res.data
    useNotify().success('Settings saved')
    return true
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Save failed')
    return false
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="settings-page">
    <div class="settings-header">
      <h1 style="margin: 0">Settings</h1>
      <p class="muted" style="margin: 0.5rem 0 0">Application-wide Konga configuration.</p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="settings" class="settings-shell">
      <nav class="settings-nav" aria-label="Settings sections">
        <NuxtLink
          v-for="item in TABS"
          :key="item.id"
          class="settings-nav-link"
          :class="{ active: tab === item.id }"
          :to="{ path: '/settings', query: { tab: item.id } }"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="settings-pane stack">
        <SettingsGeneralSection v-if="tab === 'general'" :settings="settings" :save="save" />
        <SettingsSignupSection v-else-if="tab === 'signup'" :settings="settings" :save="save" />
        <SettingsSocialLoginSection
          v-else-if="tab === 'social'"
          :settings="settings"
          @updated="settings = $event"
        />
        <SettingsNotificationsSection
          v-else-if="tab === 'notifications'"
          :settings="settings"
          :save="save"
          :saving="saving"
        />
        <SettingsPermissionsSection v-else-if="tab === 'permissions'" :settings="settings" :save="save" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  min-width: 0;
}

.settings-header {
  margin-bottom: 1.25rem;
}

.settings-shell {
  display: grid;
  grid-template-columns: 15rem minmax(0, 1fr);
  gap: 0;
  align-items: start;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card-bg);
  overflow: hidden;
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.75rem 0;
  border-right: 1px solid var(--border);
  background: var(--panel-nav-bg);
  min-height: 24rem;
}

.settings-nav-link {
  position: relative;
  display: block;
  padding: 0.55rem 1rem 0.55rem 1.15rem;
  color: var(--text);
  text-decoration: none;
  font-size: 0.92rem;
}

.settings-nav-link:hover {
  background: var(--hover-tint);
}

.settings-nav-link.active {
  font-weight: 650;
  background: var(--hover-tint);
}

.settings-nav-link.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.35rem;
  bottom: 0.35rem;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--accent);
}

.settings-pane {
  padding: 1.25rem 1.5rem 1.5rem;
  min-width: 0;
}

@media (max-width: 800px) {
  .settings-shell {
    grid-template-columns: 1fr;
  }

  .settings-nav {
    flex-direction: row;
    flex-wrap: wrap;
    min-height: 0;
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding: 0.5rem;
    gap: 0.25rem;
  }

  .settings-nav-link {
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
  }

  .settings-nav-link.active::before {
    display: none;
  }
}
</style>
