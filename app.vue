<script setup lang="ts">
useHead({
  link: [{ rel: 'icon', type: 'image/png', href: '/images/konga-logo.png' }]
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <AppToasts />
</template>
