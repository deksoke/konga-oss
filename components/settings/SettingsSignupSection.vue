<script setup lang="ts">
import type { SaveSettings, Settings } from '~/types/settings'

defineProps<{
  settings: Settings
  save: SaveSettings
}>()
</script>

<template>
  <section class="card stack">
    <h2 class="section-title">Sign up restrictions</h2>
    <label class="row check-row">
      <input v-model="settings.signup_enable" type="checkbox" @change="save()" />
      <span>
        Allow users to sign up.
        <span class="help">If enabled, users will be allowed to sign up.</span>
      </span>
    </label>
    <label class="row check-row">
      <input v-model="settings.signup_require_activation" type="checkbox" @change="save()" />
      <span>
        Send activation email.
        <span class="help">If disabled, users activate automatically.</span>
      </span>
    </label>
  </section>
</template>

<style scoped>
.section-title {
  margin: 0;
  font-size: 1.15rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border, rgba(127, 127, 127, 0.25));
}
.help {
  margin: 0.35rem 0 0;
  color: var(--muted);
  font-size: 0.85rem;
  display: block;
}
.check-row {
  align-items: flex-start;
  gap: 0.65rem;
}
</style>
