<script setup lang="ts">
export type NavIconName =
  | 'dashboard'
  | 'info'
  | 'services'
  | 'routes'
  | 'consumers'
  | 'plugins'
  | 'upstreams'
  | 'certificates'
  | 'users'
  | 'connections'
  | 'snapshots'
  | 'settings'

defineProps<{
  name: NavIconName
  size?: number
}>()
</script>

<template>
  <svg
    class="nav-icon"
    :width="size || 18"
    :height="size || 18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- mdi-view-dashboard -->
    <g v-if="name === 'dashboard'" fill="currentColor">
      <rect x="3" y="3" width="8" height="8" rx="1.2" />
      <rect x="13" y="3" width="8" height="5" rx="1.2" />
      <rect x="13" y="10" width="8" height="11" rx="1.2" />
      <rect x="3" y="13" width="8" height="8" rx="1.2" />
    </g>

    <!-- mdi-information-outline -->
    <g v-else-if="name === 'info'" stroke="currentColor" stroke-width="1.8" fill="none">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 10.5v5" stroke-linecap="round" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </g>

    <!-- mdi-cloud-outline -->
    <path
      v-else-if="name === 'services'"
      d="M7.5 18h9.2A3.8 3.8 0 0 0 20 14.4a3.7 3.7 0 0 0-2.2-3.4A5.2 5.2 0 0 0 8.1 9.4 4 4 0 0 0 7.5 18z"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- mdi-directions-fork -->
    <g v-else-if="name === 'routes'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" />
      <path d="M12 17.4V11" />
      <path d="M12 11l-5-5" />
      <path d="M12 11l5-5" />
      <circle cx="7" cy="6" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="17" cy="6" r="1.6" fill="currentColor" stroke="none" />
    </g>

    <!-- mdi-account-outline -->
    <g v-else-if="name === 'consumers'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19c1.4-3 3.7-4.5 6.5-4.5S17.1 16 18.5 19" />
    </g>

    <!-- mdi-power-plug -->
    <g v-else-if="name === 'plugins'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 3v5M15 3v5" />
      <path d="M8 8h8v3.2a5 5 0 0 1-3.2 4.7V21h-1.6v-5.1A5 5 0 0 1 8 11.2V8z" />
    </g>

    <!-- mdi-shuffle-variant -->
    <g v-else-if="name === 'upstreams'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 7h4.5l7 10H21" />
      <path d="M18 14l3 3-3 3" />
      <path d="M4 17h4.5l2.2-3.1" />
      <path d="M14.2 9.2L16.5 7H21" />
      <path d="M18 4l3 3-3 3" />
    </g>

    <!-- mdi-certificate -->
    <g v-else-if="name === 'certificates'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="4" width="16" height="12" rx="1.5" />
      <path d="M9 20l3-2.5L15 20v-4H9v4z" />
      <path d="M8 9h8M8 12h5" />
    </g>

    <!-- mdi-account-multiple-outline -->
    <g v-else-if="name === 'users'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <circle cx="9" cy="8" r="2.8" />
      <path d="M3.5 18c1.1-2.4 2.9-3.6 5.5-3.6" />
      <circle cx="16.5" cy="9" r="2.4" />
      <path d="M14 14.4c2.2 0 3.8 1 4.8 3.1" />
    </g>

    <!-- mdi-cast-connected -->
    <g v-else-if="name === 'connections'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="5" width="18" height="12" rx="1.5" />
      <path d="M3 19h4" />
      <path d="M7 15.5a5 5 0 0 1 5 5" />
      <path d="M7 12a8.5 8.5 0 0 1 8.5 8.5" />
      <circle cx="7.2" cy="18.8" r="1" fill="currentColor" stroke="none" />
    </g>

    <!-- mdi-camera -->
    <g v-else-if="name === 'snapshots'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 8.5h3l1.4-2h7.2l1.4 2H20v10H4V8.5z" />
      <circle cx="12" cy="13.2" r="3.2" />
    </g>

    <!-- mdi-settings -->
    <g v-else-if="name === 'settings'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H10a1.7 1.7 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V10c.3.6.9 1 1.6 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
      />
    </g>
  </svg>
</template>
