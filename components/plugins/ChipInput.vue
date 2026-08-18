<script setup lang="ts">
const props = defineProps<{
  modelValue: unknown[]
  placeholder?: string
  elementType?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: unknown[]]
}>()

const draft = ref('')

const chips = computed(() => (Array.isArray(props.modelValue) ? props.modelValue : []))

function coerce(raw: string): unknown {
  const v = raw.trim()
  if (!v) return null
  if (props.elementType === 'integer' || props.elementType === 'number') {
    const n = Number(v)
    return Number.isNaN(n) ? null : n
  }
  return v
}

function addChip() {
  const value = coerce(draft.value)
  if (value === null) {
    draft.value = ''
    return
  }
  // Avoid duplicates for simple string tags/values
  if (chips.value.some((c) => String(c) === String(value))) {
    draft.value = ''
    return
  }
  emit('update:modelValue', [...chips.value, value])
  draft.value = ''
}

function removeChip(index: number) {
  const next = chips.value.slice()
  next.splice(index, 1)
  emit('update:modelValue', next)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    addChip()
  } else if (event.key === 'Backspace' && !draft.value && chips.value.length) {
    removeChip(chips.value.length - 1)
  }
}

/** Flush typed-but-unconfirmed draft into the model (e.g. before form submit). */
function flush() {
  addChip()
}

defineExpose({ flush })
</script>

<template>
  <div class="chip-input">
    <div class="chip-list">
      <span v-for="(chip, i) in chips" :key="`${String(chip)}-${i}`" class="chip">
        {{ chip }}
        <button type="button" class="chip-remove" aria-label="Remove" @click="removeChip(i)">×</button>
      </span>
      <input
        v-model="draft"
        class="chip-draft"
        type="text"
        :placeholder="chips.length ? '' : placeholder || 'Type and press Enter'"
        @keydown="onKeydown"
        @blur="addChip"
      />
    </div>
    <p class="field-help">Tip: Press <code>Enter</code> to accept a value.</p>
  </div>
</template>
