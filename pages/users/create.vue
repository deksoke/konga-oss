<script setup lang="ts">
definePageMeta({ layout: 'default' })

const form = reactive({
  username: '',
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  password_confirmation: '',
  active: true,
  admin: false
})
const error = ref('')
const saving = ref(false)

async function submit() {
  error.value = ''
  if (!form.username.trim() || !form.firstName.trim() || !form.lastName.trim()) {
    error.value = 'Username, first name and last name are required'
    return
  }
  if (form.password !== form.password_confirmation) {
    error.value = 'Passwords do not match'
    return
  }
  saving.value = true
  try {
    const res = await $fetch<{ data: { id: string } }>('/api/users', {
      method: 'POST',
      body: { ...form }
    })
    useNotify().success('User created')
    await navigateTo(`/users/${res.data.id}`)
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Failed to create user'
    useNotify().error(error.value)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="stack" style="max-width: 52rem">
    <div class="row" style="justify-content: space-between">
      <div>
        <h1 style="margin: 0">Create User</h1>
        <p class="muted" style="margin: 0.5rem 0 0">Add a Konga application user.</p>
      </div>
      <NuxtLink class="btn" to="/users">Back</NuxtLink>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <form class="card stack" @submit.prevent="submit">
      <div class="grid-2">
        <div class="stack">
          <div>
            <label class="label">Username <span class="text-danger">*</span></label>
            <input v-model="form.username" class="input" required placeholder="Enter a username..." />
          </div>
          <div>
            <label class="label">First Name <span class="text-danger">*</span></label>
            <input v-model="form.firstName" class="input" required placeholder="Enter the user's first name" />
          </div>
          <div>
            <label class="label">Last Name <span class="text-danger">*</span></label>
            <input v-model="form.lastName" class="input" required placeholder="Enter the user's last name..." />
          </div>
          <div>
            <label class="label">Email address</label>
            <input v-model="form.email" class="input" type="email" required placeholder="Enter a valid email address..." />
          </div>
        </div>
        <div class="stack">
          <div>
            <label class="label">Password <span class="text-danger">*</span></label>
            <input v-model="form.password" class="input" type="password" required minlength="8" />
          </div>
          <div>
            <label class="label">Confirm password <span class="text-danger">*</span></label>
            <input v-model="form.password_confirmation" class="input" type="password" required minlength="8" />
          </div>
          <label class="row" style="gap: 0.5rem">
            <input v-model="form.active" type="checkbox" />
            <span>Will this user be active?</span>
          </label>
          <label class="row" style="gap: 0.5rem">
            <input v-model="form.admin" type="checkbox" />
            <span>Is this user an administrator?</span>
          </label>
        </div>
      </div>
      <button class="btn btn-primary" type="submit" :disabled="saving" style="width: 100%">
        {{ saving ? 'Submitting...' : 'Submit User' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}
@media (max-width: 800px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }
}
.text-danger {
  color: var(--danger, #c0392b);
}
</style>
