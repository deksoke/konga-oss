<script setup lang="ts">
import ChipInput from '~/components/plugins/ChipInput.vue'

type RouteLike = {
  id: string
  name?: string | null
  paths?: string[] | null
  methods?: string[] | null
  hosts?: string[] | null
  protocols?: string[] | null
  strip_path?: boolean
  preserve_host?: boolean
  tags?: string[] | null
}

const props = defineProps<{
  serviceId: string
  serviceName?: string
  route?: RouteLike | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

defineOptions({ name: 'CreateRouteModal' })

const { kongFetch } = useKong()
const saving = ref(false)
const error = ref('')
const isEdit = computed(() => Boolean(props.route?.id))

const form = reactive({
  name: '',
  paths: [] as unknown[],
  methods: [] as unknown[],
  hosts: [] as unknown[],
  protocols: ['http', 'https'] as unknown[],
  strip_path: true,
  preserve_host: false,
  tags: [] as unknown[]
})

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? [...value] : []
}

function fillFromRoute(route: RouteLike) {
  form.name = route.name || ''
  form.paths = asList(route.paths)
  form.methods = asList(route.methods)
  form.hosts = asList(route.hosts)
  form.protocols = asList(route.protocols?.length ? route.protocols : ['http', 'https'])
  form.strip_path = route.strip_path !== false
  form.preserve_host = Boolean(route.preserve_host)
  form.tags = asList(route.tags)
}

watch(
  () => props.route,
  (route) => {
    if (route) fillFromRoute(route)
  },
  { immediate: true }
)

async function submit() {
  error.value = ''
  if (import.meta.client && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  await nextTick()

  if (!form.paths.length && !form.hosts.length && !form.methods.length) {
    error.value = 'At least one of hosts, paths, or methods must be set.'
    useNotify().error(error.value)
    return
  }
  saving.value = true
  try {
    const body: Record<string, unknown> = {
      name: form.name.trim() || null,
      paths: form.paths.map(String),
      methods: form.methods.map(String),
      hosts: form.hosts.map(String),
      protocols: form.protocols.map(String),
      strip_path: form.strip_path,
      preserve_host: form.preserve_host,
      tags: form.tags.map(String)
    }

    if (isEdit.value && props.route?.id) {
      await kongFetch(`routes/${props.route.id}`, { method: 'PATCH', body })
      useNotify().success('Route updated successfully')
    } else {
      await kongFetch(`services/${props.serviceId}/routes`, {
        method: 'POST',
        body
      })
      useNotify().success('Route created successfully')
    }
    emit('saved')
  } catch (e: any) {
    error.value =
      e?.data?.data?.message ||
      e?.data?.statusMessage ||
      (isEdit.value ? 'Failed to update route' : 'Failed to create route')
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
    <div class="modal-panel" role="dialog" aria-modal="true" :aria-label="isEdit ? 'Update Route' : 'Add Route'">
      <div class="modal-header">
        <h2 style="margin: 0; font-size: 1.1rem">
          <template v-if="isEdit">Update route</template>
          <template v-else>Add Route{{ serviceName ? ` to ${serviceName}` : '' }}</template>
        </h2>
        <button class="banner-close" type="button" @click="emit('close')">×</button>
      </div>
      <div class="modal-subhead muted">
        Tip: for hosts, paths, methods and protocols press Enter to apply each value.
      </div>
      <div class="modal-body stack">
        <p v-if="error" class="error">{{ error }}</p>

        <div>
          <label class="label">Name</label>
          <input v-model="form.name" class="input" placeholder="Optional route name" />
        </div>
        <div class="row">
          <div style="flex: 1">
            <label class="label">Paths</label>
            <ChipInput v-model="form.paths" placeholder="/api" />
          </div>
          <div style="flex: 1">
            <label class="label">Methods</label>
            <ChipInput v-model="form.methods" placeholder="GET" />
          </div>
        </div>
        <div class="row">
          <div style="flex: 1">
            <label class="label">Hosts</label>
            <ChipInput v-model="form.hosts" placeholder="example.com" />
          </div>
          <div style="flex: 1">
            <label class="label">Protocols</label>
            <ChipInput v-model="form.protocols" />
          </div>
        </div>
        <div>
          <label class="label">Tags</label>
          <ChipInput v-model="form.tags" placeholder="Add a tag and press Enter" />
        </div>
        <div class="row">
          <label class="toggle">
            <input v-model="form.strip_path" type="checkbox" />
            <span class="toggle-track"><span class="toggle-thumb" /></span>
            <span class="toggle-label">Strip Path</span>
          </label>
          <label class="toggle">
            <input v-model="form.preserve_host" type="checkbox" />
            <span class="toggle-track"><span class="toggle-thumb" /></span>
            <span class="toggle-label">Preserve Host</span>
          </label>
        </div>
      </div>
      <div class="modal-footer modal-footer-stretch">
        <button class="btn btn-primary plugin-submit" type="button" :disabled="saving" @click="submit">
          {{ saving ? 'Saving…' : '✓ Submit Route' }}
        </button>
      </div>
    </div>
  </div>
</template>
