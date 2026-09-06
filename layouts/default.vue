<script setup lang="ts">
import type { NavIconName } from '~/components/NavIcon.vue'
import NavIcon from '~/components/NavIcon.vue'
import ThemePicker from '~/components/ThemePicker.vue'
import { formatBuildDate } from '~/utils/formatBuildDate'

const { user, logout, refresh } = useAuth()
const { nodes, refreshConnectionNodes } = useConnectionNodes()
const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const buildDateLabel = computed(() => formatBuildDate(String(runtimeConfig.public.buildDate || '')))
const error = ref('')
const sidebarOpen = ref(true)
const isMobile = ref(false)

type NavItem = { to: string; label: string; icon: NavIconName; adminOnly?: boolean }

const gatewayItems: NavItem[] = [
  { to: '/info', label: 'Info', icon: 'info' },
  { to: '/services', label: 'Services', icon: 'services' },
  { to: '/routes', label: 'Routes', icon: 'routes' },
  { to: '/consumers', label: 'Consumers', icon: 'consumers' },
  { to: '/plugins', label: 'Plugins', icon: 'plugins' },
  { to: '/upstreams', label: 'Upstreams', icon: 'upstreams' },
  { to: '/certificates', label: 'Certificates', icon: 'certificates' }
]

const GATEWAY_PATH_PREFIXES = gatewayItems.map((item) => item.to)

function isApiGatewayRoute(path: string) {
  return GATEWAY_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

const applicationItems: NavItem[] = [
  { to: '/users', label: 'Users', icon: 'users', adminOnly: true },
  { to: '/connections', label: 'Connections', icon: 'connections' },
  { to: '/snapshots', label: 'Snapshots', icon: 'snapshots', adminOnly: true },
  { to: '/settings', label: 'Settings', icon: 'settings', adminOnly: true }
]

const visibleAppItems = computed(() =>
  applicationItems.filter((item) => !item.adminOnly || user.value?.role === 'admin')
)

function syncViewport() {
  if (!import.meta.client) return
  const mobile = window.matchMedia('(max-width: 960px)').matches
  const wasMobile = isMobile.value
  isMobile.value = mobile
  if (mobile && !wasMobile) sidebarOpen.value = false
  if (!mobile && wasMobile) sidebarOpen.value = true
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function closeSidebarOnMobile() {
  if (isMobile.value) sidebarOpen.value = false
}

async function loadNodes() {
  try {
    await refreshConnectionNodes()
    error.value = ''
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || 'Failed to load connections'
  }
}

onMounted(async () => {
  syncViewport()
  window.addEventListener('resize', syncViewport)
  await refresh()
  await loadNodes()
})

onBeforeUnmount(() => {
  if (import.meta.client) window.removeEventListener('resize', syncViewport)
})

watch(() => user.value?.activeNodeId, loadNodes)
watch(
  () => route.fullPath,
  () => closeSidebarOnMobile()
)

async function onActivate(id: string) {
  if (!id || id === user.value?.activeNodeId) return
  const wasOnGateway = isApiGatewayRoute(route.path)
  await $fetch(`/api/nodes/${id}/activate`, { method: 'POST' })
  await refresh()
  if (wasOnGateway) {
    await navigateTo('/')
  }
}

async function onLogout() {
  await logout()
  useTheme().syncFromUser('auto')
  await navigateTo('/login')
}
</script>

<template>
  <div class="shell" :class="{ 'sidebar-open': sidebarOpen, 'sidebar-collapsed': !sidebarOpen }">
    <div
      v-if="sidebarOpen && isMobile"
      class="sidebar-backdrop"
      aria-hidden="true"
      @click="sidebarOpen = false"
    />

    <aside class="sidebar" :aria-hidden="!sidebarOpen && isMobile ? 'true' : undefined">
      <div class="sidebar-top">
        <NuxtLink to="/" class="brand" @click="closeSidebarOnMobile">
          <h3 class="brand-title">KONGA</h3>
        </NuxtLink>
      </div>
      <nav class="nav">
        <NuxtLink
          to="/"
          class="nav-link"
          active-class=""
          exact-active-class="active"
          @click="closeSidebarOnMobile"
        >
          <NavIcon name="dashboard" />
          <span>Dashboard</span>
        </NuxtLink>

        <div v-if="user?.activeNodeId" class="nav-group">
          <div class="nav-heading">API Gateway</div>
          <NuxtLink
            v-for="item in gatewayItems"
            :key="item.to"
            :to="item.to"
            class="nav-link"
            active-class="active"
            @click="closeSidebarOnMobile"
          >
            <NavIcon :name="item.icon" />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </div>

        <div class="nav-group">
          <div class="nav-heading">Application</div>
          <NuxtLink
            v-for="item in visibleAppItems"
            :key="item.to"
            :to="item.to"
            class="nav-link"
            active-class="active"
            @click="closeSidebarOnMobile"
          >
            <NavIcon :name="item.icon" />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </div>
      </nav>
      <div class="sidebar-footer stack">
        <NuxtLink
          v-if="user"
          to="/profile"
          class="sidebar-user"
          @click="closeSidebarOnMobile"
        >
          <span class="sidebar-user-name">{{ user.username }}</span>
          <span class="muted" style="font-size: 0.8rem">{{ user.role }} · Profile</span>
        </NuxtLink>
        <button class="btn" type="button" @click="onLogout">Logout</button>
        <p v-if="buildDateLabel" class="muted" style="font-size: 0.8rem">{{ buildDateLabel }}</p>
      </div>
    </aside>

    <div class="main">
      <div class="topbar">
        <div class="topbar-left">
          <button
            class="icon-btn hamburger"
            type="button"
            :aria-label="sidebarOpen ? 'Hide menu' : 'Show menu'"
            :aria-expanded="sidebarOpen"
            @click="toggleSidebar"
          >
            <span class="hamburger-lines" aria-hidden="true">
              <span /><span /><span />
            </span>
          </button>
          <div class="connection-picker">
            <div class="muted connection-label">Active Kong connection</div>
            <select
              class="select connection-select"
              :value="user?.activeNodeId || ''"
              @change="onActivate(($event.target as HTMLSelectElement).value)"
            >
              <option value="" disabled>Select a connection</option>
              <option v-for="n in nodes" :key="n.id" :value="n.id">
                {{ n.name }} — {{ n.kongAdminUrl }}
              </option>
            </select>
          </div>
        </div>
        <div class="topbar-right row">
          <ThemePicker />
        </div>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="page-content">
        <slot />
      </div>
    </div>
  </div>
</template>
