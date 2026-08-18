<script setup lang="ts">
const props = defineProps<{
  upstreamId: string
}>()

const emit = defineEmits<{
  close: []
  created: []
}>()

defineOptions({ name: 'AddTargetModal' })

const { kongFetch } = useKong()
const saving = ref(false)
const error = ref('')
const form = reactive({
  target: '',
  weight: 100 as number | null
})

async function submit() {
  error.value = ''
  if (!form.target.trim()) {
    error.value = 'Target is required.'
    useNotify().error(error.value)
    return
  }
  saving.value = true
  try {
    const body: Record<string, unknown> = { target: form.target.trim() }
    if (form.weight != null && form.weight !== ('' as any)) body.weight = Number(form.weight)
    await kongFetch(`upstreams/${props.upstreamId}/targets`, { method: 'POST', body })
    useNotify().success('Target added')
    emit('created')
  } catch (e: any) {
    error.value = e?.data?.data?.message || e?.data?.statusMessage || 'Failed to add target'
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
    <div class="modal-panel" role="dialog" aria-modal="true" aria-label="Add Target">
      <div class="modal-header">
        <h2 style="margin: 0; font-size: 1.1rem">Add new target</h2>
        <button class="banner-close" type="button" @click="emit('close')">×</button>
      </div>
      <div class="modal-body stack">
        <p v-if="error" class="error">{{ error }}</p>
        <div>
          <label class="label">Target <span class="error">*</span></label>
          <input v-model="form.target" class="input" placeholder="hostname:port or ip:port" required />
          <p class="field-help">
            Address and port. If port is omitted it defaults to <code>8000</code>.
          </p>
        </div>
        <div>
          <label class="label">Weight</label>
          <input v-model.number="form.weight" class="input" type="number" min="0" max="65535" />
          <p class="field-help">
            Weight within the upstream load balancer (<code>0–1000</code>, defaults to <code>100</code>). Use
            <code>0</code> to disable a target.
          </p>
        </div>
      </div>
      <div class="modal-footer modal-footer-stretch">
        <button class="btn btn-primary plugin-submit" type="button" :disabled="saving" @click="submit">
          {{ saving ? 'Saving…' : '✓ Submit target' }}
        </button>
      </div>
    </div>
  </div>
</template>
