<script setup lang="ts">
definePageMeta({ layout: 'default' })

type AppUser = {
  id: string
  username: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'user'
  admin: boolean
  active: boolean
  createdAt: string
  updatedAt: string
}

type SortKey = 'username' | 'firstName' | 'lastName' | 'createdAt' | 'updatedAt'

const { user } = useAuth()
const items = ref<AppUser[]>([])
const error = ref('')

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
} = useListTable<AppUser, SortKey>({
  key: 'users',
  items,
  defaultSortKey: 'createdAt',
  defaultSortDesc: true,
  descKeys: ['createdAt', 'updatedAt'],
  match: (u, q) =>
    [u.username, u.firstName, u.lastName, u.email].join(' ').toLowerCase().includes(q),
  sortValue: (u, key) => {
    if (key === 'createdAt') return new Date(u.createdAt).getTime() || 0
    if (key === 'updatedAt') return new Date(u.updatedAt).getTime() || 0
    return String(u[key] || '').toLowerCase()
  }
})

function formatDate(value?: string) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

async function load() {
  error.value = ''
  try {
    const res = await $fetch<{ data: AppUser[] }>('/api/users')
    items.value = res.data || []
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Failed to load users'
  }
}

async function remove(u: AppUser) {
  if (u.id === user.value?.id) return
  if (!confirm(`Delete user ${u.username}?`)) return
  try {
    await $fetch(`/api/users/${u.id}`, { method: 'DELETE' })
    useNotify().success('User deleted')
    await load()
  } catch (e: any) {
    useNotify().error(e?.data?.statusMessage || 'Delete failed')
  }
}

onMounted(() => {
  restore()
  load()
})
</script>

<template>
  <div class="stack">
    <div>
      <h1 style="margin: 0">Users</h1>
      <p class="muted" style="margin: 0.5rem 0 0">Manage Konga application users.</p>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="row" style="justify-content: space-between">
      <NuxtLink class="btn btn-primary" to="/users/create">+ Create User</NuxtLink>
      <div class="row">
        <input v-model="search" class="input" style="width: 220px" type="search" placeholder="search..." />
        <span class="muted">Results: {{ filtered.length }}</span>
      </div>
    </div>

    <div class="card" style="overflow-x: auto">
      <table class="table">
        <thead>
          <tr>
            <th style="width: 1%" />
            <th class="th-upper">
              <button class="sort-btn" type="button" @click="toggleSort('username')">
                Username
                <span v-if="sortArrow('username')" aria-hidden="true">{{ sortArrow('username') }}</span>
              </button>
            </th>
            <th class="th-upper">
              <button class="sort-btn" type="button" @click="toggleSort('firstName')">
                First name
                <span v-if="sortArrow('firstName')" aria-hidden="true">{{ sortArrow('firstName') }}</span>
              </button>
            </th>
            <th class="th-upper">
              <button class="sort-btn" type="button" @click="toggleSort('lastName')">
                Last name
                <span v-if="sortArrow('lastName')" aria-hidden="true">{{ sortArrow('lastName') }}</span>
              </button>
            </th>
            <th class="th-upper">
              <button class="sort-btn" type="button" @click="toggleSort('createdAt')">
                Created
                <span v-if="sortArrow('createdAt')" aria-hidden="true">{{ sortArrow('createdAt') }}</span>
              </button>
            </th>
            <th class="th-upper">
              <button class="sort-btn" type="button" @click="toggleSort('updatedAt')">
                Updated
                <span v-if="sortArrow('updatedAt')" aria-hidden="true">{{ sortArrow('updatedAt') }}</span>
              </button>
            </th>
            <th style="width: 1%" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in paged" :key="u.id">
            <td>
              <span :title="u.admin ? 'Administrator' : 'User'" :style="{ color: u.admin ? 'var(--warn)' : 'var(--muted)' }">
                {{ u.admin ? '★' : '○' }}
              </span>
            </td>
            <td>
              <NuxtLink :to="`/users/${u.id}`">{{ u.username }}</NuxtLink>
              <span v-if="!u.active" class="muted" style="margin-left: 0.35rem">(inactive)</span>
            </td>
            <td>{{ u.firstName || '—' }}</td>
            <td>{{ u.lastName || '—' }}</td>
            <td>{{ formatDate(u.createdAt) }}</td>
            <td>{{ formatDate(u.updatedAt) }}</td>
            <td>
              <button
                v-if="u.id !== user?.id"
                class="btn btn-link-danger"
                type="button"
                @click="remove(u)"
              >
                Delete
              </button>
              <span v-else class="muted" title="You cannot delete your own account">—</span>
            </td>
          </tr>
          <tr v-if="!filtered.length">
            <td colspan="7" class="muted" style="text-align: center">no data found...</td>
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
  </div>
</template>
