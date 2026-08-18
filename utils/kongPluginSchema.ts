export type SchemaFieldDef = {
  type?: string
  default?: unknown
  required?: boolean
  one_of?: unknown[]
  elements?: SchemaFieldDef
  values?: SchemaFieldDef
  fields?: Array<Record<string, SchemaFieldDef>> | Record<string, SchemaFieldDef>
  description?: string
  reference?: string
  eq?: unknown
  ne?: unknown
}

export type ParsedPluginSchema = {
  topLevel: Record<string, SchemaFieldDef>
  config: Record<string, SchemaFieldDef>
  raw: unknown
}

const SKIP_TOP = new Set(['name', 'id', 'created_at', 'updated_at', 'tags', 'instance_name'])
const ENTITY_KEYS = new Set([
  'consumer',
  'service',
  'route',
  'protocols',
  'enabled',
  'tags',
  'name',
  'id',
  'created_at',
  'updated_at',
  'instance_name',
  'ordering',
  'partials',
  'ws_id',
  'config'
])

export function fieldsToMap(
  fields: Array<Record<string, SchemaFieldDef>> | Record<string, SchemaFieldDef> | undefined
): Record<string, SchemaFieldDef> {
  if (!fields) return {}
  if (!Array.isArray(fields)) return { ...fields }
  const out: Record<string, SchemaFieldDef> = {}
  for (const item of fields) {
    if (!item || typeof item !== 'object') continue
    const key = Object.keys(item)[0]
    if (!key) continue
    out[key] = item[key]
  }
  return out
}

/**
 * Kong plugin schemas come in two shapes:
 * 1) Full entity: fields include { config: { type: 'record', fields: [...] }, consumer, ... }
 * 2) Config-only (common on GET /plugins/schema/:name): fields are response_code, cache_ttl, ...
 * Legacy Konga flattens either into form fields — we must handle both.
 */
export function parsePluginSchema(schema: any): ParsedPluginSchema {
  let topLevel = fieldsToMap(schema?.fields)

  // Older flat schema: { response_code: {...}, cache_ttl: {...} } with no `fields` wrapper
  if (!Object.keys(topLevel).length && schema && typeof schema === 'object' && !Array.isArray(schema)) {
    const copy = { ...schema } as Record<string, SchemaFieldDef>
    delete (copy as any).fields
    topLevel = copy
  }

  const configDef = topLevel.config
  let config: Record<string, SchemaFieldDef> = {}

  if (configDef && (configDef.type === 'record' || configDef.fields)) {
    config = fieldsToMap(configDef.fields as any)
  } else {
    for (const [key, def] of Object.entries(topLevel)) {
      if (ENTITY_KEYS.has(key) || key.startsWith('_')) continue
      if (!def || typeof def !== 'object') continue
      config[key] = def
    }
  }

  const top: Record<string, SchemaFieldDef> = {}
  for (const [key, def] of Object.entries(topLevel)) {
    if (key.startsWith('_') || SKIP_TOP.has(key) || key === 'config') continue
    if (['consumer', 'service', 'route', 'protocols', 'enabled'].includes(key)) {
      top[key] = def
    }
  }

  return { topLevel: top, config, raw: schema }
}

export function defaultForField(def: SchemaFieldDef | undefined): unknown {
  if (!def) return null

  // Match legacy Konga chip fields: start empty; Kong applies schema defaults when omitted
  if (def.type === 'array' || def.type === 'set') {
    return []
  }

  if (def.default !== undefined) {
    return structuredClone(def.default)
  }

  switch (def.type) {
    case 'boolean':
      return false
    case 'map':
      return {}
    case 'record': {
      const nested = fieldsToMap(def.fields as any)
      const obj: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(nested)) {
        obj[k] = defaultForField(v)
      }
      return obj
    }
    case 'foreign':
      return null
    case 'integer':
    case 'number':
      return null
    case 'string':
    default:
      // Leave enum empty so user must choose (e.g. strategy)
      if (def.one_of?.length) return ''
      return ''
  }
}

export function initFormValues(fields: Record<string, SchemaFieldDef>): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const [key, def] of Object.entries(fields)) {
    values[key] = defaultForField(def)
  }
  return values
}

/** Prefill form from an existing plugin.config (edit mode). */
export function mergeExistingConfig(
  fields: Record<string, SchemaFieldDef>,
  existing: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const values = initFormValues(fields)
  if (!existing || typeof existing !== 'object') return values

  for (const [key, def] of Object.entries(fields)) {
    const current = existing[key]
    if (current === undefined || current === null) continue

    if ((def.type === 'record' || def.fields) && typeof current === 'object' && !Array.isArray(current)) {
      const nestedDefs = fieldsToMap(def.fields as any)
      const nestedBase = (values[key] && typeof values[key] === 'object' ? values[key] : {}) as Record<
        string,
        unknown
      >
      values[key] = { ...nestedBase, ...(current as Record<string, unknown>) }
      // Ensure nested keys from schema still exist
      for (const nk of Object.keys(nestedDefs)) {
        if ((values[key] as Record<string, unknown>)[nk] === undefined) {
          ;(values[key] as Record<string, unknown>)[nk] = defaultForField(nestedDefs[nk])
        }
      }
      continue
    }

    if ((def.type === 'array' || def.type === 'set') && Array.isArray(current)) {
      values[key] = structuredClone(current)
      continue
    }

    values[key] = structuredClone(current)
  }

  return values
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  if (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((v) => v == null || v === '')
  ) {
    return true
  }
  return false
}

/** Drop empty optional values before sending to Kong (legacy Konga behavior). */
export function pruneEmpty(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'boolean' || typeof value === 'number') {
      out[key] = value
      continue
    }
    if (isEmptyValue(value)) continue
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = pruneEmpty(value as Record<string, unknown>)
      if (!isEmptyValue(nested)) out[key] = nested
      continue
    }
    out[key] = value
  }
  return out
}

export function humanizeLabel(key: string) {
  return key.split('_').join(' ')
}

export function arrayToText(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.map(String).join(', ')
}

export function textToArray(text: string, elementType?: string): unknown[] {
  const parts = text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (elementType === 'integer' || elementType === 'number') {
    return parts.map((p) => Number(p)).filter((n) => !Number.isNaN(n))
  }
  return parts
}

export function buildPluginPayload(opts: {
  name: string
  enabled: boolean
  consumerId?: string
  protocols?: unknown
  config: Record<string, unknown>
  serviceId?: string
  routeId?: string
}) {
  const payload: Record<string, unknown> = {
    name: opts.name,
    enabled: opts.enabled
  }
  if (opts.consumerId) payload.consumer = { id: opts.consumerId }
  if (opts.serviceId) payload.service = { id: opts.serviceId }
  if (opts.routeId) payload.route = { id: opts.routeId }
  if (Array.isArray(opts.protocols) && opts.protocols.length) {
    payload.protocols = opts.protocols
  }
  const config = pruneEmpty(opts.config)
  if (Object.keys(config).length) payload.config = config
  return payload
}

/** Payload for PATCH /plugins/:id — keep config keys even when empty arrays if present in form. */
export function buildPluginUpdatePayload(opts: {
  enabled: boolean
  consumerId?: string
  config: Record<string, unknown>
  protocols?: unknown
}) {
  const config = { ...opts.config }
  for (const [k, v] of Object.entries(config)) {
    if (v === '') delete config[k]
  }

  const payload: Record<string, unknown> = {
    enabled: opts.enabled,
    config: pruneEmpty(config)
  }

  if (opts.consumerId) {
    payload.consumer = { id: opts.consumerId }
  } else {
    payload.consumer = null
  }

  if (Array.isArray(opts.protocols) && opts.protocols.length) {
    payload.protocols = opts.protocols
  }

  return payload
}
