<script setup lang="ts">
import type { ThemePreference } from '~/composables/useAuth'

const { preference, setPreference } = useTheme()

const options: Array<{ value: ThemePreference; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'night', label: 'Night' },
  { value: 'auto', label: 'Auto' }
]
</script>

<template>
  <div class="theme-picker" role="group" aria-label="Theme">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="theme-btn"
      :class="{ active: preference === opt.value }"
      :title="opt.value === 'auto' ? 'Auto (local time 06:00–18:00)' : opt.label"
      @click="setPreference(opt.value)"
    >
      <span v-if="opt.value === 'day'" aria-hidden="true">☀</span>
      <span v-else-if="opt.value === 'night'" aria-hidden="true">☾</span>
      <span v-else aria-hidden="true">◐</span>
      <span>{{ opt.label }}</span>
    </button>
  </div>
</template>
