<script setup lang="ts">
import CertificateModal from '~/components/certificates/CertificateModal.vue'
import UiIcon from '~/components/UiIcon.vue'

type KongCertificate = {
  id: string
  cert?: string
  key?: string
  snis?: string[]
  tags?: string[] | null
  created_at?: number
  [key: string]: unknown
}

type KongSni = {
  name: string
  certificate?: { id?: string } | null
  [key: string]: unknown
}

type SortKey = 'id' | 'tags' | 'snis' | 'created'

const { kongFetch } = useKong()
const items = ref<KongCertificate[]>([])
const error = ref('')
const showCreate = ref(false)
const editing = ref<KongCertificate | null>(null)

const {
  search,
  pageSize,
  page,
  filtered,
  paged,
  totalPages,
  pageRange,
  toggleSort,
  sortArrow,
  goToPage,
  setPageSize,
  restore
} = useListTable<KongCertificate, SortKey>({
  key: 'certificates',
  items,
  defaultSortKey: 'created',
  defaultSortDesc: true,
  descKeys: ['created'],
  match: (c, q) => {
    const hay = [c.id, ...(c.tags || []), ...(c.snis || [])].join(' ').toLowerCase()
    return hay.includes(q)
  },
  sortValue: (c, key) => {
    if (key === 'id') return c.id
    if (key === 'tags') return (c.tags || []).join(' ').toLowerCase()
    if (key === 'snis') return (c.snis || []).join(' ').toLowerCase()
    return c.created_at || 0
  }
})

function formatCreated(ts?: number) {
  if (!ts) return '—'
  const ms = ts > 1e12 ? ts : ts * 1000
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function load() {
  error.value = ''
  try {
    const [certsRes, snisRes] = await Promise.all([
      kongFetch<{ data: KongCertificate[] }>('certificates', { query: { size: 1000 } }),
      kongFetch<{ data: KongSni[] }>('snis', { query: { size: 1000 } }).catch(() => ({ data: [] as KongSni[] }))
    ])
    const snisByCert = new Map<string, string[]>()
    for (const sni of snisRes.data || []) {
      const certId = sni.certificate?.id
      if (!certId) continue
      const list = snisByCert.get(certId) || []
      list.push(sni.name)
      snisByCert.set(certId, list)
    }
    items.value = (certsRes.data || []).map((c) => ({
      ...c,
      snis: c.snis?.length ? c.snis : snisByCert.get(c.id) || []
    }))
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Failed to load certificates'
  }
}

async function remove(id: string) {
  if (!confirm('Delete certificate?')) return
  try {
    await kongFetch(`certificates/${id}`, { method: 'DELETE' })
    useNotify().success('Certificate deleted')
    await load()
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Delete failed')
  }
}

function onSaved() {
  showCreate.value = false
  editing.value = null
  load()
}

onMounted(() => {
  restore()
  load()
})
</script>

<template>
  <div class="stack">
    <div>
      <h1 style="margin: 0">Certificates</h1>
      <p class="muted" style="margin: 0.5rem 0 0; max-width: 52rem">
        A certificate object represents a public certificate/private key pair for an SSL certificate. These objects are
        used by Kong to handle SSL/TLS termination for encrypted requests. Certificates are optionally associated with
        SNI objects to tie a cert/key pair to one or more hostnames.
      </p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="row" style="justify-content: space-between">
      <button class="btn btn-primary" type="button" @click="showCreate = true">+ Add Certificate</button>
      <div class="row">
        <input v-model="search" class="input" style="width: 220px" type="search" placeholder="search..." />
        <span class="muted">Results: {{ filtered.length }}</span>
      </div>
    </div>

    <div class="card" style="overflow-x: auto">
      <table class="table">
        <thead>
          <tr>
            <th class="th-upper">
              <button class="sort-btn" type="button" @click="toggleSort('id')">
                Id
                <span v-if="sortArrow('id')" aria-hidden="true">{{ sortArrow('id') }}</span>
              </button>
            </th>
            <th class="th-upper">
              <button class="sort-btn" type="button" @click="toggleSort('tags')">
                Tags
                <span v-if="sortArrow('tags')" aria-hidden="true">{{ sortArrow('tags') }}</span>
              </button>
            </th>
            <th class="th-upper">
              <button class="sort-btn" type="button" @click="toggleSort('snis')">
                Snis
                <span v-if="sortArrow('snis')" aria-hidden="true">{{ sortArrow('snis') }}</span>
              </button>
            </th>
            <th class="th-upper">
              <button class="sort-btn" type="button" @click="toggleSort('created')">
                Created
                <span v-if="sortArrow('created')" aria-hidden="true">{{ sortArrow('created') }}</span>
              </button>
            </th>
            <th style="width: 1%" />
            <th style="width: 1%" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in paged" :key="c.id">
            <td class="mono-id">{{ c.id }}</td>
            <td>
              <div v-if="c.tags?.length" class="tag-list">
                <span v-for="tag in c.tags" :key="tag" class="tag-pill">{{ tag }}</span>
              </div>
              <span v-else class="muted">—</span>
            </td>
            <td>
              <div v-if="c.snis?.length" class="sni-list">
                <span v-for="sni in c.snis" :key="sni" class="sni-badge">{{ sni }}</span>
              </div>
              <span v-else class="muted">—</span>
            </td>
            <td class="text-nowrap">{{ formatCreated(c.created_at) }}</td>
            <td>
              <button class="btn-link-accent" type="button" @click="editing = c">Details</button>
            </td>
            <td>
              <button class="btn-link-danger" type="button" @click="remove(c.id)">
                <UiIcon name="delete" :size="16" />
                Delete
              </button>
            </td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="6" class="muted" style="text-align: center; padding: 1.5rem">No data found...</td>
          </tr>
        </tbody>
      </table>
    </div>

    <ListPagination
      :from="pageRange.from"
      :to="pageRange.to"
      :total="filtered.length"
      :page="page"
      :total-pages="totalPages"
      :page-size="pageSize"
      @update:page="goToPage"
      @update:page-size="setPageSize"
    />

    <CertificateModal v-if="showCreate" @close="showCreate = false" @saved="onSaved" />
    <CertificateModal
      v-if="editing"
      :certificate="editing"
      @close="editing = null"
      @saved="onSaved"
    />
  </div>
</template>
