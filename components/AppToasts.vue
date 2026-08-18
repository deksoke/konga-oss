<script setup lang="ts">
const { toasts, dismiss } = useNotify()
</script>

<template>
  <div class="toast-stack" aria-live="polite" aria-relevant="additions">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast"
        :class="`toast-${t.kind}`"
        role="status"
      >
        <span class="toast-icon" aria-hidden="true">
          <template v-if="t.kind === 'success'">✓</template>
          <template v-else-if="t.kind === 'error'">!</template>
          <template v-else>i</template>
        </span>
        <span class="toast-message">{{ t.message }}</span>
        <button class="toast-close" type="button" aria-label="Dismiss" @click="dismiss(t.id)">
          ×
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
