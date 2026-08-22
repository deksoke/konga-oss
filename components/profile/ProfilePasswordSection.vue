<script setup lang="ts">
const passwordForm = defineModel<{
  current_password: string
  password: string
  password_confirmation: string
}>('form', { required: true })

defineProps<{
  saving: boolean
}>()

const emit = defineEmits<{
  save: []
}>()
</script>

<template>
  <form class="stack" @submit.prevent="emit('save')">
    <h2 class="section-title">Change password</h2>
    <div>
      <label class="label">Current password</label>
      <input
        v-model="passwordForm.current_password"
        class="input"
        type="password"
        required
        autocomplete="current-password"
      />
    </div>
    <div>
      <label class="label">New password</label>
      <input
        v-model="passwordForm.password"
        class="input"
        type="password"
        required
        minlength="8"
        autocomplete="new-password"
      />
    </div>
    <div>
      <label class="label">Confirm new password</label>
      <input
        v-model="passwordForm.password_confirmation"
        class="input"
        type="password"
        required
        minlength="8"
        autocomplete="new-password"
      />
    </div>
    <div>
      <button class="btn btn-primary" type="submit" :disabled="saving">
        {{ saving ? 'Updating…' : 'Change password' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.section-title {
  margin: 0;
  font-size: 1.1rem;
}
</style>
