<script setup lang="ts">
import ChipInput from '~/components/plugins/ChipInput.vue'

const props = defineProps<{
  type: 'basic-auth' | 'key-auth' | 'hmac-auth' | 'jwt' | 'oauth2'
  consumerId: string
  editing?: any | null
}>()

const emit = defineEmits<{ close: []; saved: [] }>()

const saving = ref(false)
const error = ref('')
const form = reactive({
  username: '',
  password: '',
  key: '',
  secret: '',
  algorithm: 'HS256',
  rsa_public_key: '',
  name: '',
  client_id: '',
  client_secret: '',
  redirect_uris: [] as unknown[]
})

const { kongFetch } = useKong()

const title = computed(() => {
  const map: Record<string, string> = {
    'basic-auth': props.editing ? 'Edit Basic Auth' : 'Create Basic Auth',
    'key-auth': 'Create API Key',
    'hmac-auth': 'Create HMAC Auth',
    jwt: 'Create JWT',
    oauth2: 'Create OAuth2'
  }
  return map[props.type]
})

onMounted(() => {
  if (props.editing && props.type === 'basic-auth') {
    form.username = props.editing.username || ''
    form.password = ''
  }
})

function clean<T extends Record<string, unknown>>(obj: T) {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === null || v === undefined) continue
    if (Array.isArray(v) && !v.length) continue
    out[k] = v
  }
  return out
}

async function submit() {
  error.value = ''
  saving.value = true
  try {
    let body: Record<string, unknown> = {}
    if (props.type === 'basic-auth') {
      if (!form.username.trim()) throw new Error('Username is required')
      body = clean({ username: form.username.trim(), password: form.password })
    } else if (props.type === 'key-auth') {
      body = clean({ key: form.key.trim() })
    } else if (props.type === 'hmac-auth') {
      if (!form.username.trim()) throw new Error('Username is required')
      body = clean({ username: form.username.trim(), secret: form.secret })
    } else if (props.type === 'jwt') {
      body = clean({
        key: form.key,
        algorithm: form.algorithm,
        rsa_public_key: form.rsa_public_key,
        secret: form.secret
      })
    } else {
      if (!form.name.trim()) throw new Error('Name is required')
      body = clean({
        name: form.name.trim(),
        client_id: form.client_id,
        client_secret: form.client_secret,
        redirect_uris: form.redirect_uris.map(String)
      })
    }

    if (props.type === 'basic-auth' && props.editing?.id) {
      await kongFetch(`consumers/${props.consumerId}/basic-auth/${props.editing.id}`, {
        method: 'PUT',
        body
      })
    } else {
      await kongFetch(`consumers/${props.consumerId}/${props.type}`, { method: 'POST', body })
    }
    useNotify().success('Credential saved')
    emit('saved')
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || 'Failed to save credential'
    useNotify().error(error.value)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-panel" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2 style="margin: 0; font-size: 1.1rem">{{ title }}</h2>
        <button class="banner-close" type="button" @click="emit('close')">×</button>
      </div>
      <div class="modal-body stack">
        <p v-if="error" class="error">{{ error }}</p>

        <template v-if="type === 'basic-auth'">
          <div>
            <label class="label">Username *</label>
            <input v-model="form.username" class="input" />
          </div>
          <div>
            <label class="label">Password</label>
            <input v-model="form.password" class="input" type="password" />
          </div>
        </template>

        <template v-else-if="type === 'key-auth'">
          <div>
            <label class="label">Key</label>
            <input v-model="form.key" class="input" placeholder="Leave empty to auto-generate" />
          </div>
        </template>

        <template v-else-if="type === 'hmac-auth'">
          <div>
            <label class="label">Username *</label>
            <input v-model="form.username" class="input" />
          </div>
          <div>
            <label class="label">Secret</label>
            <input v-model="form.secret" class="input" />
          </div>
        </template>

        <template v-else-if="type === 'jwt'">
          <div>
            <label class="label">Key</label>
            <input v-model="form.key" class="input" />
          </div>
          <div>
            <label class="label">Algorithm</label>
            <select v-model="form.algorithm" class="select">
              <option value="HS256">HS256</option>
              <option value="RS256">RS256</option>
            </select>
          </div>
          <div>
            <label class="label">RSA public key</label>
            <textarea v-model="form.rsa_public_key" class="textarea" rows="4" />
          </div>
          <div>
            <label class="label">Secret</label>
            <input v-model="form.secret" class="input" />
          </div>
        </template>

        <template v-else>
          <div>
            <label class="label">Name *</label>
            <input v-model="form.name" class="input" />
          </div>
          <div>
            <label class="label">Client ID</label>
            <input v-model="form.client_id" class="input" />
          </div>
          <div>
            <label class="label">Client secret</label>
            <input v-model="form.client_secret" class="input" />
          </div>
          <div>
            <label class="label">Redirect URIs</label>
            <ChipInput v-model="form.redirect_uris" placeholder="https://example.com/callback" />
          </div>
        </template>

        <button class="btn btn-primary" type="button" :disabled="saving" @click="submit">
          {{ saving ? 'Saving…' : 'Submit' }}
        </button>
      </div>
    </div>
  </div>
</template>
