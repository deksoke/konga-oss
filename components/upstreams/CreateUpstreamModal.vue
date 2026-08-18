<script setup lang="ts">
import UpstreamDetailsForm, {
  type UpstreamFormModel
} from '~/components/upstreams/UpstreamDetailsForm.vue'
import {
  buildUpstreamPayload,
  emptyUpstreamForm
} from '~/utils/upstreamForm'

const emit = defineEmits<{
  close: []
  created: [upstream: { id: string }]
}>()

defineOptions({ name: 'CreateUpstreamModal' })

const { kongFetch } = useKong()
const saving = ref(false)
const error = ref('')
const fieldErrors = ref<Record<string, string>>({})
const form = reactive<UpstreamFormModel>(emptyUpstreamForm())

async function submit() {
  error.value = ''
  fieldErrors.value = {}
  if (!form.name.trim()) {
    error.value = 'Name is required.'
    useNotify().error(error.value)
    return
  }
  saving.value = true
  try {
    const body = buildUpstreamPayload(form)
    const created = await kongFetch<{ id: string }>('upstreams', { method: 'POST', body })
    useNotify().success('Upstream created successfully')
    emit('created', created)
  } catch (e: any) {
    const body = e?.data?.data || e?.data
    if (body?.fields && typeof body.fields === 'object') {
      const next: Record<string, string> = {}
      for (const [k, v] of Object.entries(body.fields)) {
        next[k] = typeof v === 'string' ? v : JSON.stringify(v)
      }
      fieldErrors.value = next
    }
    error.value = body?.message || e?.data?.statusMessage || 'Failed to create upstream'
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
    <div class="modal-panel modal-panel-wide" role="dialog" aria-modal="true" aria-label="Create Upstream">
      <div class="modal-header">
        <h2 style="margin: 0; font-size: 1.1rem">Create Upstream</h2>
        <button class="banner-close" type="button" @click="emit('close')">×</button>
      </div>
      <div class="modal-body stack">
        <p v-if="error" class="error">{{ error }}</p>
        <UpstreamDetailsForm
          v-model="form"
          :field-errors="fieldErrors"
          :saving="saving"
          submit-label="✓ Submit Upstream"
          @submit="submit"
        />
      </div>
    </div>
  </div>
</template>
