<script setup lang="ts">
type AuthType = 'default' | 'key_auth' | 'jwt' | 'basic_auth'

type ConnectionNode = {
  id: string
  name: string
  kongAdminUrl: string
  authType: string
  hasApiKey?: boolean
  hasBasicAuth?: boolean
  hasJwt?: boolean
}

const props = defineProps<{
  node: ConnectionNode
}>()

const emit = defineEmits<{
  close: []
  updated: []
}>()

defineOptions({ name: 'EditConnectionModal' })

const saving = ref(false)
const error = ref('')
const authTab = ref<AuthType>(
  (['default', 'key_auth', 'jwt', 'basic_auth'].includes(props.node.authType)
    ? props.node.authType
    : 'default') as AuthType
)

const form = reactive({
  name: props.node.name,
  kongAdminUrl: props.node.kongAdminUrl,
  apiKey: '',
  username: '',
  password: '',
  jwtKey: '',
  jwtSecret: ''
})

const tabs = [
  {
    id: 'default' as const,
    label: 'Default',
    help: "Konga will connect directly to Kong's admin API. Suitable for demo or internal access. Kong's admin API should not be publicly exposed."
  },
  {
    id: 'key_auth' as const,
    label: 'Key Auth',
    help: 'Connect via a loop-back API using key authentication.'
  },
  {
    id: 'jwt' as const,
    label: 'JWT Auth',
    help: 'Connect via a loop-back API using JWT authentication.'
  },
  {
    id: 'basic_auth' as const,
    label: 'Basic Auth',
    help: 'Connect using Basic authentication. Strongly recommended to use TLS.'
  }
]

async function submit() {
  error.value = ''
  if (!form.name.trim() || !form.kongAdminUrl.trim()) {
    error.value = 'Name and Kong Admin URL are required.'
    useNotify().error(error.value)
    return
  }
  saving.value = true
  try {
    const body: Record<string, string> = {
      name: form.name.trim(),
      kongAdminUrl: form.kongAdminUrl.trim(),
      authType: authTab.value
    }
    // Only send credentials when the user entered a new value (keep existing otherwise)
    if (form.apiKey.trim()) body.apiKey = form.apiKey.trim()
    if (form.username.trim()) body.username = form.username.trim()
    if (form.password) body.password = form.password
    if (form.jwtKey.trim()) body.jwtKey = form.jwtKey.trim()
    if (form.jwtSecret) body.jwtSecret = form.jwtSecret

    await $fetch(`/api/nodes/${props.node.id}`, {
      method: 'PATCH',
      body
    })
    useNotify().success('Connection updated successfully')
    emit('updated')
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Update failed'
    useNotify().error(error.value)
  } finally {
    saving.value = false
  }
}

function onOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) emit('close')
}
</script>

<template>
  <div class="modal-overlay" @click="onOverlayClick">
    <div class="modal-panel" role="dialog" aria-modal="true" aria-label="Update Connection">
      <div class="modal-header">
        <h2 style="margin: 0; text-transform: uppercase; font-size: 1.1rem">Update Connection</h2>
        <button class="banner-close" type="button" @click="emit('close')">×</button>
      </div>
      <div class="modal-subhead muted">Choose a connection type.</div>
      <div class="modal-body stack">
        <p v-if="error" class="error">{{ error }}</p>

        <div class="plugin-tabs" role="tablist">
          <button
            v-for="t in tabs"
            :key="t.id"
            type="button"
            class="plugin-tab"
            :class="{ active: authTab === t.id }"
            @click="authTab = t.id"
          >
            {{ t.label }}
          </button>
        </div>
        <div class="info-banner">
          <small>{{ tabs.find((t) => t.id === authTab)?.help }}</small>
          <span />
        </div>

        <div>
          <label class="label">Name <span class="error">*</span></label>
          <input v-model="form.name" class="input" placeholder="A unique connection name" required />
        </div>
        <div>
          <label class="label">
            {{ authTab === 'default' ? 'Kong Admin' : 'Loopback API' }} URL
            <span class="error">*</span>
          </label>
          <input v-model="form.kongAdminUrl" class="input" type="url" required />
        </div>

        <div v-if="authTab === 'key_auth'">
          <label class="label">API key</label>
          <input
            v-model="form.apiKey"
            class="input"
            :placeholder="node.hasApiKey ? 'Leave blank to keep existing key' : 'The apikey…'"
          />
        </div>
        <div v-if="authTab === 'basic_auth'" class="row">
          <div style="flex: 1">
            <label class="label">Username</label>
            <input
              v-model="form.username"
              class="input"
              :placeholder="node.hasBasicAuth ? 'Leave blank to keep existing' : 'Username'"
            />
          </div>
          <div style="flex: 1">
            <label class="label">Password</label>
            <input
              v-model="form.password"
              class="input"
              type="password"
              :placeholder="node.hasBasicAuth ? 'Leave blank to keep existing' : 'Password'"
            />
          </div>
        </div>
        <div v-if="authTab === 'jwt'" class="stack">
          <div class="row">
            <div style="flex: 1">
              <label class="label">JWT key (kid)</label>
              <input
                v-model="form.jwtKey"
                class="input"
                :placeholder="node.hasJwt ? 'Leave blank to keep existing' : 'JWT identification key'"
              />
            </div>
            <div style="flex: 1">
              <label class="label">JWT secret</label>
              <input
                v-model="form.jwtSecret"
                class="input"
                type="password"
                :placeholder="node.hasJwt ? 'Leave blank to keep existing' : 'JWT secret'"
              />
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer modal-footer-stretch">
        <button class="btn btn-primary plugin-submit" type="button" :disabled="saving" @click="submit">
          {{ saving ? 'Saving…' : '✓ Update Connection' }}
        </button>
      </div>
    </div>
  </div>
</template>
