<script setup lang="ts">
import { fieldsToMap, humanizeLabel, type SchemaFieldDef } from '~/utils/kongPluginSchema'
import ChipInput from '~/components/plugins/ChipInput.vue'

defineOptions({ name: 'PluginSchemaField' })

const props = defineProps<{
  fieldKey: string
  def: SchemaFieldDef
  modelValue: unknown
  error?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
}>()

const nestedFields = computed(() => {
  if (props.def.type !== 'record' && !props.def.fields) return {}
  return fieldsToMap(props.def.fields as any)
})

const recordValue = computed<Record<string, unknown>>(() => {
  if (props.modelValue && typeof props.modelValue === 'object' && !Array.isArray(props.modelValue)) {
    return props.modelValue as Record<string, unknown>
  }
  return {}
})

function setRecordField(key: string, value: unknown) {
  emit('update:modelValue', { ...recordValue.value, [key]: value })
}

function setScalar(value: unknown) {
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="schema-field">
    <!-- boolean -->
    <label v-if="def.type === 'boolean'" class="toggle">
      <input
        type="checkbox"
        :checked="Boolean(modelValue)"
        @change="setScalar(($event.target as HTMLInputElement).checked)"
      />
      <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb" /></span>
      <span class="toggle-label">{{ modelValue ? 'YES' : 'NO' }}</span>
    </label>

    <!-- enum -->
    <select
      v-else-if="(def.type === 'string' || !def.type) && def.one_of?.length"
      class="select"
      :value="modelValue == null ? '' : String(modelValue)"
      @change="setScalar(($event.target as HTMLSelectElement).value)"
    >
      <option value="" disabled>Select…</option>
      <option v-for="opt in def.one_of" :key="String(opt)" :value="String(opt)">{{ opt }}</option>
    </select>

    <!-- string -->
    <input
      v-else-if="def.type === 'string'"
      class="input"
      type="text"
      :value="modelValue == null ? '' : String(modelValue)"
      @input="setScalar(($event.target as HTMLInputElement).value)"
    />

    <!-- number -->
    <input
      v-else-if="def.type === 'integer' || def.type === 'number'"
      class="input"
      type="number"
      :value="modelValue == null || modelValue === '' ? '' : Number(modelValue)"
      @input="
        setScalar(
          ($event.target as HTMLInputElement).value === ''
            ? null
            : Number(($event.target as HTMLInputElement).value)
        )
      "
    />

    <!-- array / set chips -->
    <ChipInput
      v-else-if="def.type === 'array' || def.type === 'set'"
      :model-value="Array.isArray(modelValue) ? modelValue : []"
      :element-type="def.elements?.type"
      @update:model-value="setScalar"
    />

    <!-- nested record (e.g. memory.dictionary_name) -->
    <div v-else-if="def.type === 'record' || Object.keys(nestedFields).length" class="record-box">
      <div v-for="(nestedDef, nestedKey) in nestedFields" :key="String(nestedKey)" class="record-row">
        <div class="record-label">
          <span class="record-chevron">›</span>
          {{ humanizeLabel(String(nestedKey)) }}
        </div>
        <PluginSchemaField
          :field-key="String(nestedKey)"
          :def="nestedDef"
          :model-value="recordValue[String(nestedKey)]"
          @update:model-value="setRecordField(String(nestedKey), $event)"
        />
      </div>
    </div>

    <!-- foreign / fallback -->
    <input
      v-else
      class="input"
      type="text"
      :value="modelValue == null ? '' : String(modelValue)"
      :placeholder="def.type === 'foreign' ? 'ID (optional)' : def.type || 'value'"
      @input="setScalar(($event.target as HTMLInputElement).value || null)"
    />

    <p v-if="error" class="error" style="margin: 0.25rem 0 0">{{ error }}</p>
    <p v-if="def.description" class="field-help">{{ def.description }}</p>
  </div>
</template>
