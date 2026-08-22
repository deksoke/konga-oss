<script setup lang="ts">
import type { SaveSettings, Settings } from '~/types/settings'

defineProps<{
  settings: Settings
  save: SaveSettings
}>()
</script>

<template>
  <section class="card stack">
    <h2 class="section-title">User permissions</h2>
    <div v-for="(perms, context) in settings.user_permissions" :key="context" class="perm-block">
      <h3 style="margin: 0 0 0.5rem; font-size: 0.9rem">{{ String(context).toUpperCase() }}</h3>
      <div class="row" style="flex-wrap: wrap; gap: 1rem">
        <label v-for="(val, key) in perms" :key="key" class="row" style="gap: 0.35rem">
          <input
            v-model="settings.user_permissions[context][key as keyof typeof perms]"
            type="checkbox"
            @change="save()"
          />
          <span>{{ key }}</span>
        </label>
      </div>
    </div>
  </section>
</template>

<style scoped>
.section-title {
  margin: 0;
  font-size: 1.15rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border, rgba(127, 127, 127, 0.25));
}
.perm-block {
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--surface-2, rgba(127, 127, 127, 0.08));
}
</style>
