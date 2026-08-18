<script setup lang="ts">
import ChipInput from '~/components/plugins/ChipInput.vue'

type Certificate = {
  id?: string
  cert?: string
  key?: string
  snis?: string[]
  tags?: string[]
  [key: string]: unknown
}

const props = defineProps<{
  certificate?: Certificate | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

defineOptions({ name: 'CertificateModal' })

const { kongFetch } = useKong()
const isEdit = computed(() => Boolean(props.certificate?.id))
const saving = ref(false)
const error = ref('')
const showAddSni = ref(false)
const newSni = ref('')

const form = reactive({
  cert: props.certificate?.cert || '',
  key: props.certificate?.key || '',
  snisText: (props.certificate?.snis || []).join(', '),
  snis: [...(props.certificate?.snis || [])] as string[],
  tags: [...(props.certificate?.tags || [])] as unknown[]
})

async function submitCreate() {
  error.value = ''
  if (!form.cert.trim() || !form.key.trim()) {
    error.value = 'The Certificate and/or Key fields cannot be empty'
    useNotify().error(error.value)
    return
  }
  saving.value = true
  try {
    const body: Record<string, unknown> = {
      cert: form.cert.trim(),
      key: form.key.trim()
    }
    const snis = form.snisText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (snis.length) body.snis = snis
    if (form.tags.length) body.tags = form.tags.map(String)

    await kongFetch('certificates', { method: 'POST', body })
    useNotify().success('Certificate created')
    emit('saved')
  } catch (e: any) {
    error.value = e?.data?.data?.message || e?.data?.statusMessage || 'Failed to create certificate'
    useNotify().error(error.value)
  } finally {
    saving.value = false
  }
}

async function submitUpdate() {
  error.value = ''
  if (!props.certificate?.id) return
  if (!form.cert.trim() || !form.key.trim()) {
    error.value = 'The Certificate and/or Key fields cannot be empty'
    useNotify().error(error.value)
    return
  }
  saving.value = true
  try {
    const body: Record<string, unknown> = {
      cert: form.cert.trim(),
      key: form.key.trim()
    }
    if (form.tags.length) body.tags = form.tags.map(String)
    else body.tags = []

    await kongFetch(`certificates/${props.certificate.id}`, { method: 'PATCH', body })
    useNotify().success('Certificate updated')
    emit('saved')
  } catch (e: any) {
    error.value = e?.data?.data?.message || e?.data?.statusMessage || 'Failed to update certificate'
    useNotify().error(error.value)
  } finally {
    saving.value = false
  }
}

async function addSni() {
  if (!props.certificate?.id || !newSni.value.trim()) return
  try {
    await kongFetch('snis', {
      method: 'POST',
      body: {
        name: newSni.value.trim(),
        certificate: { id: props.certificate.id }
      }
    })
    form.snis.push(newSni.value.trim())
    newSni.value = ''
    showAddSni.value = false
    useNotify().success('SNI added')
  } catch (e: any) {
    useNotify().error(e?.data?.data?.message || e?.data?.statusMessage || 'Failed to add SNI')
  }
}

async function deleteSni(name: string) {
  if (!confirm('Really want to delete the selected SNI?')) return
  try {
    await kongFetch(`snis/${encodeURIComponent(name)}`, { method: 'DELETE' })
    form.snis = form.snis.filter((s) => s !== name)
    useNotify().success('SNI deleted')
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Failed to delete SNI')
  }
}

function onOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) emit('close')
}
</script>

<template>
  <div class="modal-overlay" @click="onOverlayClick">
    <div class="modal-panel modal-panel-wide" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2 style="margin: 0; font-size: 1.1rem">
          {{ isEdit ? 'Certificate Details' : 'Add Certificate' }}
        </h2>
        <button class="banner-close" type="button" @click="emit('close')">×</button>
      </div>
      <div class="modal-body stack">
        <p v-if="error" class="error">{{ error }}</p>

        <div>
          <label class="label">Certificate</label>
          <textarea v-model="form.cert" class="textarea mono-textarea" rows="8" />
        </div>
        <div>
          <label class="label">Key</label>
          <textarea v-model="form.key" class="textarea mono-textarea" rows="8" />
        </div>

        <div v-if="!isEdit">
          <label class="label">Server Name Indications</label>
          <p class="muted" style="margin: 0 0 0.4rem; font-size: 0.85rem">
            A comma separated list of Server Name Indications. ex:
            <code>ssl-example.com,other-ssl-example.com</code>
          </p>
          <input v-model="form.snisText" class="input" />
        </div>

        <div v-else>
          <label class="label">Server Name Indications</label>
          <div class="sni-list">
            <span v-for="sni in form.snis" :key="sni" class="sni-badge">
              {{ sni }}
              <button class="sni-remove" type="button" title="Delete SNI" @click="deleteSni(sni)">×</button>
            </span>
            <button class="btn-link-accent" type="button" @click="showAddSni = !showAddSni">+ Add SNI</button>
          </div>
          <div v-if="showAddSni" class="row" style="margin-top: 0.65rem">
            <input v-model="newSni" class="input" style="flex: 1" placeholder="hostname" @keyup.enter="addSni" />
            <button class="btn btn-primary" type="button" @click="addSni">Add</button>
          </div>
        </div>

        <div>
          <label class="label">
            Tags
            <em class="muted" style="font-weight: 400"> — optional</em>
          </label>
          <ChipInput v-model="form.tags" placeholder="Add a tag and press Enter" />
        </div>
      </div>
      <div class="modal-footer modal-footer-stretch">
        <button
          v-if="!isEdit"
          class="btn btn-primary plugin-submit"
          type="button"
          :disabled="saving"
          @click="submitCreate"
        >
          {{ saving ? 'Saving…' : 'Submit Certificates' }}
        </button>
        <button
          v-else
          class="btn btn-primary plugin-submit"
          type="button"
          :disabled="saving"
          @click="submitUpdate"
        >
          {{ saving ? 'Saving…' : 'OK' }}
        </button>
      </div>
    </div>
  </div>
</template>
