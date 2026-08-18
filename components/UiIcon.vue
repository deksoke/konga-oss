<script setup lang="ts">
defineProps<{
  name:
    | 'strip-path'
    | 'preserve-host'
    | 'preserve-host-off'
    | 'eye'
    | 'lan-connect'
    | 'lan-disconnect'
    | 'heart'
    | 'heart-outline'
    | 'heart-pulse'
    | 'heart-broken'
    | 'heart-off'
    | 'check-circle'
    | 'delete'
    | 'camera'
    | 'upload'
    | 'list'
    | 'calendar'
    | 'info'
  size?: number
}>()
</script>

<template>
  <svg
    class="ui-icon"
    :width="size || 20"
    :height="size || 20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- unlink / strip path (mdi-link-off style) -->
    <g v-if="name === 'strip-path'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 7h2a4 4 0 0 1 0 8h-2" />
      <path d="M7 7H5a4 4 0 0 0 0 8h2" />
      <path d="M8 12h4" />
      <path d="M4 4l16 16" />
    </g>

    <!-- cloud outline -->
    <path
      v-else-if="name === 'preserve-host'"
      d="M7.5 18h9.2A3.8 3.8 0 0 0 20 14.4a3.7 3.7 0 0 0-2.2-3.4A5.2 5.2 0 0 0 8.1 9.4 4 4 0 0 0 7.5 18z"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- cloud off -->
    <g v-else-if="name === 'preserve-host-off'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7.5 18h9.2A3.8 3.8 0 0 0 20 14.4a3.7 3.7 0 0 0-1.4-2.8" />
      <path d="M8.1 9.4A5.2 5.2 0 0 1 16 10.2" />
      <path d="M4 4l16 16" />
      <path d="M7.5 18A4 4 0 0 1 5.2 11.2" />
    </g>

    <!-- eye / raw view -->
    <g v-else-if="name === 'eye'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
    </g>

    <!-- lan connect (active connection) -->
    <g v-else-if="name === 'lan-connect'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="7" height="7" rx="1.2" />
      <rect x="14" y="13" width="7" height="7" rx="1.2" />
      <path d="M10 7.5h3.5A2.5 2.5 0 0 1 16 10v3" />
    </g>

    <!-- lan disconnect -->
    <g v-else-if="name === 'lan-disconnect'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="7" height="7" rx="1.2" />
      <rect x="14" y="13" width="7" height="7" rx="1.2" />
      <path d="M10 7.5h2" />
      <path d="M15 16.5h-1" />
      <path d="M4 4l16 16" />
    </g>

    <!-- solid heart -->
    <path
      v-else-if="name === 'heart'"
      d="M12 20.4S3.5 14.8 3.5 9.6A4.1 4.1 0 0 1 12 7.2a4.1 4.1 0 0 1 8.5 2.4C20.5 14.8 12 20.4 12 20.4z"
      fill="currentColor"
      stroke="currentColor"
      stroke-width="1.2"
      stroke-linejoin="round"
    />

    <!-- heart outline -->
    <path
      v-else-if="name === 'heart-outline'"
      d="M12 20.4S3.5 14.8 3.5 9.6A4.1 4.1 0 0 1 12 7.2a4.1 4.1 0 0 1 8.5 2.4C20.5 14.8 12 20.4 12 20.4z"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linejoin="round"
    />

    <!-- heart with pulse (healthy) -->
    <g v-else-if="name === 'heart-pulse'" fill="currentColor">
      <path d="M12 20.4S3.5 14.8 3.5 9.6A4.1 4.1 0 0 1 12 7.2a4.1 4.1 0 0 1 8.5 2.4C20.5 14.8 12 20.4 12 20.4z" />
      <path
        d="M7.5 12h2.2l1.1-2.4 1.6 4.6 1.2-2.2H16.5"
        fill="none"
        stroke="#fff"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </g>

    <!-- broken heart (unhealthy) -->
    <g v-else-if="name === 'heart-broken'" fill="currentColor">
      <path d="M12 20.4S3.5 14.8 3.5 9.6A4.1 4.1 0 0 1 12 7.2V20.4z" />
      <path d="M12 7.2a4.1 4.1 0 0 1 8.5 2.4C20.5 14.8 12 20.4 12 20.4V7.2z" />
      <path d="M12 9.2l-1.4 2.2 2.2 1.6-1.6 2.4" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
    </g>

    <!-- heart off (set unhealthy) -->
    <g v-else-if="name === 'heart-off'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 20.4S3.5 14.8 3.5 9.6A4.1 4.1 0 0 1 8.2 6.3" />
      <path d="M10.2 6.6A4.1 4.1 0 0 1 20.5 9.6C20.5 12.8 17.6 16.2 14.8 18.4" />
      <path d="M4 4l16 16" />
    </g>

    <!-- check circle (set healthy) -->
    <g v-else-if="name === 'check-circle'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="8.2" />
      <path d="M8.2 12.2l2.4 2.4 5.2-5.4" />
    </g>

    <!-- delete / trash -->
    <g v-else-if="name === 'delete'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 7h16" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M6.5 7l.8 12.2A1.5 1.5 0 0 0 8.8 20.5h6.4a1.5 1.5 0 0 0 1.5-1.3L17.5 7" />
      <path d="M10 11v6M14 11v6" />
    </g>

    <!-- mdi-camera -->
    <g v-else-if="name === 'camera'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 8.5h3l1.4-2h7.2l1.4 2H20v10H4V8.5z" />
      <circle cx="12" cy="13.2" r="3.2" />
    </g>

    <!-- mdi-upload -->
    <g v-else-if="name === 'upload'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 15V5" />
      <path d="M8 9l4-4 4 4" />
      <path d="M5 19h14" />
    </g>

    <!-- mdi-format-list-bulleted -->
    <g v-else-if="name === 'list'" fill="currentColor">
      <circle cx="5" cy="7" r="1.4" />
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="5" cy="17" r="1.4" />
      <rect x="9" y="6.1" width="11" height="1.8" rx="0.6" />
      <rect x="9" y="11.1" width="11" height="1.8" rx="0.6" />
      <rect x="9" y="16.1" width="11" height="1.8" rx="0.6" />
    </g>

    <!-- mdi-calendar -->
    <g v-else-if="name === 'calendar'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3.5" y="5" width="17" height="15.5" rx="1.5" />
      <path d="M8 3.5v3M16 3.5v3M3.5 9.5h17" />
    </g>

    <!-- mdi-information-outline -->
    <g v-else-if="name === 'info'" stroke="currentColor" stroke-width="1.8" fill="none">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 10.5v5" stroke-linecap="round" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </g>
  </svg>
</template>
