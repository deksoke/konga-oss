<script setup lang="ts">
const profileForm = defineModel<{
  username: string
  firstName: string
  lastName: string
  email: string
}>('form', { required: true })

defineProps<{
  roleLabel: string
  statusLabel: string
  saving: boolean
}>()

const emit = defineEmits<{
  save: []
}>()
</script>

<template>
  <form class="stack" @submit.prevent="emit('save')">
    <h2 class="section-title">Account</h2>
    <div>
      <label class="label">Username</label>
      <input v-model="profileForm.username" class="input" required minlength="3" autocomplete="username" />
    </div>
    <div class="row name-row">
      <div class="name-field">
        <label class="label">First name</label>
        <input v-model="profileForm.firstName" class="input" autocomplete="given-name" />
      </div>
      <div class="name-field">
        <label class="label">Last name</label>
        <input v-model="profileForm.lastName" class="input" autocomplete="family-name" />
      </div>
    </div>
    <div>
      <label class="label">Email</label>
      <input v-model="profileForm.email" class="input" type="email" required autocomplete="email" />
    </div>
    <div class="muted meta">Role: {{ roleLabel }} · Status: {{ statusLabel }}</div>
    <div>
      <button class="btn btn-primary" type="submit" :disabled="saving">
        {{ saving ? 'Saving…' : 'Save profile' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.section-title {
  margin: 0;
  font-size: 1.1rem;
}

.name-row {
  gap: 0.75rem;
}

.name-field {
  flex: 1;
}

.meta {
  font-size: 0.9rem;
}
</style>
