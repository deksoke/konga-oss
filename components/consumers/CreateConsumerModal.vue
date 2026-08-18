<script setup lang="ts">
import ChipInput from '~/components/plugins/ChipInput.vue'

const emit = defineEmits<{
  close: []
  created: [consumer: { id: string }]
}>()

defineOptions({ name: 'CreateConsumerModal' })

const { kongFetch } = useKong()
const saving = ref(false)
const error = ref('')
const errors = ref<Record<string, string>>({})

const form = reactive({
  username: '',
  custom_id: '',
  tags: [] as unknown[]
})

async function submit() {
  error.value = ''
  errors.value = {}
  if (!form.username.trim() && !form.custom_id.trim()) {
    error.value = 'You must provide either username or custom_id.'
    useNotify().error(error.value)
    return
  }
  saving.value = true
  try {
    const body: Record<string, unknown> = {}
    if (form.username.trim()) body.username = form.username.trim()
    if (form.custom_id.trim()) body.custom_id = form.custom_id.trim()
    if (form.tags.length) body.tags = form.tags.map(String)

    const created = await kongFetch<{ id: string }>('consumers', { method: 'POST', body })
    useNotify().success('Consumer created successfully!')
    emit('created', created)
  } catch (e: any) {
    const data = e?.data?.data || e?.data
    if (data?.fields && typeof data.fields === 'object') {
      const next: Record<string, string> = {}
      for (const [k, v] of Object.entries(data.fields)) {
        next[k] = Array.isArray(v) ? v.join(', ') : String(v)
      }
      errors.value = next
    }
    error.value = data?.message || e?.data?.statusMessage || 'Failed to create consumer'
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
    <div class="modal-panel" role="dialog" aria-modal="true" aria-label="Create Consumer">
      <div class="modal-header">
        <h2 style="margin: 0; font-size: 1.1rem">Create Consumer</h2>
        <button class="banner-close" type="button" @click="emit('close')">×</button>
      </div>
      <div class="modal-body stack">
        <p v-if="error" class="error">{{ error }}</p>

        <div>
          <label class="label">
            username
            <em class="muted" style="font-weight: 400"> — semi-optional</em>
          </label>
          <input v-model="form.username" class="input" :class="{ 'input-error': errors.username }" />
          <p v-if="errors.username" class="error" style="margin: 0.35rem 0 0">{{ errors.username }}</p>
          <p class="muted" style="margin: 0.35rem 0 0; font-size: 0.85rem">
            The username of the consumer. You must send either this field or
            <code>custom_id</code> with the request.
          </p>
        </div>

        <div>
          <label class="label">
            custom_id
            <em class="muted" style="font-weight: 400"> — semi-optional</em>
          </label>
          <input v-model="form.custom_id" class="input" :class="{ 'input-error': errors.custom_id }" />
          <p v-if="errors.custom_id" class="error" style="margin: 0.35rem 0 0">{{ errors.custom_id }}</p>
          <p class="muted" style="margin: 0.35rem 0 0; font-size: 0.85rem">
            Field for storing an existing ID for the consumer, useful for mapping Kong with users in your existing
            database. You must send either this field or <code>username</code> with the request.
          </p>
        </div>

        <div>
          <label class="label">
            Tags
            <em class="muted" style="font-weight: 400"> — optional</em>
          </label>
          <ChipInput v-model="form.tags" placeholder="Add a tag and press Enter" />
          <p class="muted" style="margin: 0.35rem 0 0; font-size: 0.85rem">Optionally add tags to the consumer</p>
        </div>
      </div>
      <div class="modal-footer modal-footer-stretch">
        <button class="btn btn-primary plugin-submit" type="button" :disabled="saving" @click="submit">
          {{ saving ? 'Saving…' : '✓ Submit Consumer' }}
        </button>
      </div>
    </div>
  </div>
</template>
