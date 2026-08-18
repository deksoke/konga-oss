<script setup lang="ts">
import { PAGE_SIZES, type PageSize } from '~/composables/useListTable'

withDefaults(
  defineProps<{
    from: number
    to: number
    total: number
    page: number
    totalPages: number
    pageSize: number
    showPageSize?: boolean
  }>(),
  { showPageSize: true }
)

const emit = defineEmits<{
  'update:page': [number]
  'update:pageSize': [PageSize]
}>()

function onPageSize(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  if (PAGE_SIZES.includes(value as PageSize)) emit('update:pageSize', value as PageSize)
}
</script>

<template>
  <div class="pagination-bar">
    <span class="muted">Showing {{ from }}–{{ to }} of {{ total }}</span>
    <div class="row" style="gap: 0.5rem">
      <button class="btn" type="button" :disabled="page <= 1" @click="emit('update:page', page - 1)">
        Prev
      </button>
      <span class="muted">Page {{ page }} / {{ totalPages }}</span>
      <button
        class="btn"
        type="button"
        :disabled="page >= totalPages"
        @click="emit('update:page', page + 1)"
      >
        Next
      </button>
    </div>
    <label v-if="showPageSize" class="row" style="gap: 0.4rem">
      <span class="muted">Page size</span>
      <select class="input" style="width: auto" :value="pageSize" @change="onPageSize">
        <option v-for="size in PAGE_SIZES" :key="size" :value="size">{{ size }}</option>
      </select>
    </label>
  </div>
</template>
