<script setup lang="ts">
import type { SaveSettings, Settings } from '~/types/settings'

defineProps<{
  settings: Settings
  save: SaveSettings
}>()
</script>

<template>
  <section class="card stack">
    <h2 class="section-title">General settings</h2>
    <div class="grid-2">
      <div>
        <label class="label">Dashboard refresh interval</label>
        <input
          v-model.number="settings.info_polling_interval"
          class="input"
          type="number"
          min="0"
          @change="save()"
        />
        <p class="help">Milliseconds. Set to 0 to disable polling.</p>
      </div>
      <div>
        <label class="label">Base URL</label>
        <input v-model="settings.baseUrl" class="input" placeholder="ex. http://my-konga.io" @change="save()" />
        <p class="help">Used for generating links. Leave blank to use the server address.</p>
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
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.help {
  margin: 0.35rem 0 0;
  color: var(--muted);
  font-size: 0.85rem;
  display: block;
}
@media (max-width: 800px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }
}
</style>
