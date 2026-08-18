<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const { user: authUser, refresh } = useAuth()
const id = computed(() => String(route.params.id))

type AppUser = {
  id: string
  username: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'user'
  admin: boolean
  active: boolean
  activeNodeId: string | null
  createdAt: string
  updatedAt: string
}

const item = ref<AppUser | null>(null)
const editing = ref(false)
const error = ref('')
const saving = ref(false)
const connections = ref<Array<{ id: string; name: string; kongAdminUrl: string }>>([])
const form = reactive({
  username: '',
  firstName: '',
  lastName: '',
  email: '',
  active: true,
  admin: false,
  activeNodeId: '' as string | null,
  password: '',
  password_confirmation: ''
})

async function load() {
  error.value = ''
  try {
    const [userRes, nodesRes] = await Promise.all([
      $fetch<{ data: AppUser }>(`/api/users/${id.value}`),
      $fetch<{ data: Array<{ id: string; name: string; kongAdminUrl: string }> }>('/api/nodes')
    ])
    item.value = userRes.data
    connections.value = nodesRes.data || []
    Object.assign(form, {
      username: userRes.data.username,
      firstName: userRes.data.firstName,
      lastName: userRes.data.lastName,
      email: userRes.data.email,
      active: userRes.data.active,
      admin: userRes.data.admin,
      activeNodeId: userRes.data.activeNodeId || '',
      password: '',
      password_confirmation: ''
    })
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'User not found'
    item.value = null
  }
}

function cancelEditing() {
  if (!item.value) return
  editing.value = false
  Object.assign(form, {
    username: item.value.username,
    firstName: item.value.firstName,
    lastName: item.value.lastName,
    email: item.value.email,
    active: item.value.active,
    admin: item.value.admin,
    activeNodeId: item.value.activeNodeId || '',
    password: '',
    password_confirmation: ''
  })
}

async function save() {
  if (!item.value) return
  saving.value = true
  error.value = ''
  try {
    const isSelf = authUser.value?.id === id.value
    const body: Record<string, unknown> = {
      username: form.username,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email
    }
    if (authUser.value?.role === 'admin' && !isSelf) {
      body.active = form.active
      body.admin = form.admin
      body.activeNodeId = form.activeNodeId || null
    }
    if (form.password) {
      body.password = form.password
      body.password_confirmation = form.password_confirmation
    }
    const res = await $fetch<{ data: AppUser }>(`/api/users/${id.value}`, {
      method: 'PATCH',
      body
    })
    item.value = res.data
    editing.value = false
    useNotify().success('User saved')
    if (isSelf) await refresh()
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Save failed'
    useNotify().error(error.value)
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!item.value || item.value.id === authUser.value?.id) return
  if (!confirm(`Delete user ${item.value.username}?`)) return
  try {
    await $fetch(`/api/users/${item.value.id}`, { method: 'DELETE' })
    useNotify().success('User deleted')
    await navigateTo('/users')
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Delete failed')
  }
}

onMounted(load)
watch(id, load)
</script>

<template>
  <div class="stack" style="max-width: 52rem">
    <p v-if="error && !item" class="error">{{ error }}</p>
    <template v-if="item">
      <div class="row" style="justify-content: space-between; align-items: center">
        <h1 style="margin: 0">{{ item.username }}</h1>
        <div class="row">
          <template v-if="editing">
            <button class="btn btn-primary" type="button" :disabled="saving" @click="save">Save</button>
            <button class="btn btn-danger" type="button" @click="cancelEditing">Cancel</button>
          </template>
          <template v-else>
            <button class="btn btn-edit" type="button" @click="editing = true">Edit</button>
            <button
              v-if="item.id !== authUser?.id"
              class="btn btn-danger"
              type="button"
              @click="remove"
            >
              Delete
            </button>
            <NuxtLink class="btn" to="/users">Back</NuxtLink>
          </template>
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="card">
        <table class="table table-clean">
          <tbody>
            <tr>
              <th>Username</th>
              <td>
                <input v-if="editing" v-model="form.username" class="input" />
                <span v-else>{{ item.username }}</span>
              </td>
            </tr>
            <tr>
              <th>First Name</th>
              <td>
                <input v-if="editing" v-model="form.firstName" class="input" />
                <span v-else>{{ item.firstName || '—' }}</span>
              </td>
            </tr>
            <tr>
              <th>Last Name</th>
              <td>
                <input v-if="editing" v-model="form.lastName" class="input" />
                <span v-else>{{ item.lastName || '—' }}</span>
              </td>
            </tr>
            <tr>
              <th>Email</th>
              <td>
                <input v-if="editing" v-model="form.email" class="input" type="email" />
                <a v-else-if="item.email" :href="`mailto:${item.email}`">{{ item.email }}</a>
                <span v-else>—</span>
              </td>
            </tr>
            <tr v-if="editing && authUser?.role === 'admin' && item.id !== authUser?.id">
              <th>Active connection</th>
              <td>
                <select v-model="form.activeNodeId" class="select">
                  <option value="">— none —</option>
                  <option v-for="c in connections" :key="c.id" :value="c.id">
                    {{ c.name }} | {{ c.kongAdminUrl }}
                  </option>
                </select>
              </td>
            </tr>
            <tr v-if="editing && authUser?.role === 'admin' && item.id !== authUser?.id">
              <th>Active</th>
              <td><input v-model="form.active" type="checkbox" /></td>
            </tr>
            <tr v-if="editing && authUser?.role === 'admin' && item.id !== authUser?.id">
              <th>Administrator</th>
              <td><input v-model="form.admin" type="checkbox" /></td>
            </tr>
            <tr v-if="editing">
              <th>New password</th>
              <td>
                <div class="stack">
                  <input v-model="form.password" class="input" type="password" placeholder="Leave blank to keep" />
                  <input
                    v-model="form.password_confirmation"
                    class="input"
                    type="password"
                    placeholder="Confirm new password"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="!editing">
              <th>Role</th>
              <td>{{ item.admin ? 'Administrator' : 'User' }}</td>
            </tr>
            <tr v-if="!editing">
              <th>Status</th>
              <td>{{ item.active ? 'Active' : 'Inactive' }}</td>
            </tr>
            <tr>
              <th>Created</th>
              <td>{{ new Date(item.createdAt).toLocaleString() }}</td>
            </tr>
            <tr>
              <th>Updated</th>
              <td>{{ new Date(item.updatedAt).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.table-clean th {
  width: 10rem;
  text-align: left;
  color: var(--muted);
  font-weight: 600;
  vertical-align: top;
  padding: 0.65rem 0.5rem;
}
.table-clean td {
  padding: 0.65rem 0.5rem;
}
</style>
