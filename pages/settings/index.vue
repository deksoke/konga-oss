<script setup lang="ts">
import type { Settings } from '~/types/settings'

definePageMeta({ layout: 'default' })

const settings = ref<Settings | null>(null)
const error = ref('')
const saving = ref(false)

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
  <div class="stack" style="max-width: 56rem">
    <div>
      <h1 style="margin: 0">Settings</h1>
      <p class="muted" style="margin: 0.5rem 0 0">Application-wide Konga configuration.</p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <form v-if="settings" class="stack" @submit.prevent="save()">
      <SettingsGeneralSection :settings="settings" />
      <SettingsSignupSection :settings="settings" :save="save" />
      <SettingsSocialLoginSection :settings="settings" @updated="settings = $event" />
      <SettingsNotificationsSection :settings="settings" :save="save" :saving="saving" />
      <SettingsPermissionsSection :settings="settings" :save="save" />

      <button class="btn btn-primary" type="submit" :disabled="saving" style="width: 100%">
        {{ saving ? 'Saving...' : 'Save settings' }}
      </button>
    </form>
  </div>
</template>
