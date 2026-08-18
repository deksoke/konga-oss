import { kongRequest, type KongNodeRecord } from './kong'

type ListResponse = {
  data?: unknown[]
  offset?: string
  next?: string
}

export async function kongListAll(node: KongNodeRecord, path: string): Promise<any[]> {
  const items: any[] = []
  let offset: string | undefined

  for (let i = 0; i < 100; i++) {
    const qs = new URLSearchParams({ size: '1000' })
    if (offset) qs.set('offset', offset)
    const clean = path.replace(/^\/+/, '').split('?')[0]
    const res = (await kongRequest(node, 'GET', `${clean}?${qs.toString()}`)) as ListResponse
    const batch = Array.isArray(res?.data) ? res.data : []
    items.push(...batch)
    if (!res?.offset || batch.length === 0) break
    offset = res.offset
  }

  return items
}

function withoutTrailingSlash(url: string) {
  return url.replace(/\/+$/, '')
}

export type SnapshotEntities = {
  services: any[]
  routes: any[]
  consumers: any[]
  plugins: any[]
  acls: any[]
  upstreams: any[]
  certificates: any[]
  snis: any[]
  [key: string]: any[]
}

const CREDENTIAL_KEYS = ['basic-auths', 'key-auths', 'hmac-auths', 'jwts', 'oauth2'] as const

const PLUGIN_FOR_CRED: Record<(typeof CREDENTIAL_KEYS)[number], string> = {
  'basic-auths': 'basic-auth',
  'key-auths': 'key-auth',
  'hmac-auths': 'hmac-auth',
  jwts: 'jwt',
  oauth2: 'oauth2'
}

export async function takeKongSnapshot(node: KongNodeRecord, name?: string) {
  const info = (await kongRequest(node, 'GET', '')) as {
    version?: string
    plugins?: { enabled_in_cluster?: string[] }
  }
  const enabled = new Set(info.plugins?.enabled_in_cluster || [])

  const entities: SnapshotEntities = {
    services: [],
    routes: [],
    consumers: [],
    plugins: [],
    acls: [],
    upstreams: [],
    certificates: [],
    snis: []
  }

  for (const entity of Object.keys(entities)) {
    try {
      entities[entity] = await kongListAll(node, entity)
    } catch {
      entities[entity] = []
    }
  }

  for (const upstream of entities.upstreams) {
    try {
      upstream.targets = await kongListAll(node, `upstreams/${upstream.id}/targets`)
    } catch {
      upstream.targets = []
    }
  }

  const credentials: Record<string, any[]> = {}
  for (const key of CREDENTIAL_KEYS) {
    if (!enabled.has(PLUGIN_FOR_CRED[key])) continue
    try {
      credentials[key] = await kongListAll(node, key)
    } catch {
      credentials[key] = []
    }
  }

  for (const consumer of entities.consumers) {
    consumer.credentials = {}
    for (const key of Object.keys(credentials)) {
      consumer.credentials[key] = credentials[key].filter(
        (item) => item?.consumer?.id === consumer.id || item?.consumer_id === consumer.id
      )
    }
  }

  return {
    name: name?.trim() || `snap@${Date.now()}`,
    kongNodeName: node.name,
    kongNodeUrl: withoutTrailingSlash(node.kongAdminUrl),
    kongVersion: info.version || '',
    data: entities
  }
}

function omitKeys<T extends Record<string, unknown>>(obj: T, keys: string[]) {
  const out: Record<string, unknown> = { ...obj }
  for (const k of keys) delete out[k]
  return out
}

function makeBucket(response: Record<string, any>, key: string) {
  if (!response[key]) {
    response[key] = { imported: 0, failed: { count: 0, items: [] as string[] } }
  }
}

function pushFail(response: Record<string, any>, entity: string, err: any) {
  makeBucket(response, entity)
  response[entity].failed.count++
  const msg =
    err?.data?.message ||
    err?.statusMessage ||
    (typeof err?.data === 'string' ? err.data : null) ||
    JSON.stringify(err?.data || err?.message || err)
  if (!response[entity].failed.items.includes(msg)) {
    response[entity].failed.items.push(msg)
  }
}

const PLURAL_TO_SINGULAR: Record<string, string> = {
  'basic-auths': 'basic-auth',
  'key-auths': 'key-auth',
  'hmac-auths': 'hmac-auth',
  jwts: 'jwt',
  oauth2: 'oauth2'
}

const DEFAULT_RESTORE_ORDER = [
  'certificates',
  'snis',
  'services',
  'routes',
  'consumers',
  'plugins',
  'acls',
  'upstreams'
]

const ALLOWED_RESTORE_KEYS = new Set([
  ...DEFAULT_RESTORE_ORDER,
  'basic-auths',
  'key-auths',
  'hmac-auths',
  'jwts',
  'oauth2'
])

export async function restoreKongSnapshot(
  node: KongNodeRecord,
  data: Record<string, any[]>,
  imports?: string[]
) {
  const responseData: Record<string, any> = {}
  const requested = (imports?.length
    ? imports
    : DEFAULT_RESTORE_ORDER.filter((k) => Array.isArray(data[k]))
  ).filter((k) => ALLOWED_RESTORE_KEYS.has(k))
  const ordered = [
    ...DEFAULT_RESTORE_ORDER.filter((k) => requested.includes(k)),
    ...requested.filter((k) => !DEFAULT_RESTORE_ORDER.includes(k))
  ]

  for (const entity of ordered) {
    if (entity === 'consumers') {
      makeBucket(responseData, 'consumers')
      for (const consumer of data.consumers || []) {
        try {
          await kongRequest(
            node,
            'PUT',
            `consumers/${consumer.id}`,
            omitKeys(consumer, ['id', 'credentials', 'acls', 'plugins']),
            { keepPut: true }
          )
          responseData.consumers.imported++

          const creds = consumer.credentials || {}
          for (const key of Object.keys(creds)) {
            makeBucket(responseData, key)
            for (const cred of creds[key] || []) {
              const singular = PLURAL_TO_SINGULAR[key] || key
              try {
                await kongRequest(
                  node,
                  'POST',
                  `consumers/${consumer.id}/${singular}`,
                  omitKeys(cred, ['id', 'consumer', 'consumer_id'])
                )
                responseData[key].imported++
              } catch (e: any) {
                pushFail(responseData, key, e)
              }
            }
          }
        } catch (e: any) {
          pushFail(responseData, 'consumers', e)
        }
      }
    } else if (entity === 'upstreams') {
      makeBucket(responseData, 'upstreams')
      makeBucket(responseData, 'upstream_targets')
      for (const upstream of data.upstreams || []) {
        try {
          await kongRequest(
            node,
            'PUT',
            `upstreams/${upstream.id}`,
            omitKeys(upstream, ['id', 'targets']),
            { keepPut: true }
          )
          responseData.upstreams.imported++
          for (const target of upstream.targets || []) {
            try {
              await kongRequest(node, 'POST', `upstreams/${upstream.id}/targets`, {
                target: target.target,
                weight: target.weight
              })
              responseData.upstream_targets.imported++
            } catch (e: any) {
              pushFail(responseData, 'upstream_targets', e)
            }
          }
        } catch (e: any) {
          pushFail(responseData, 'upstreams', e)
        }
      }
    } else if (Array.isArray(data[entity])) {
      makeBucket(responseData, entity)
      for (const item of data[entity]) {
        try {
          await kongRequest(
            node,
            'PUT',
            `${entity}/${item.id}`,
            omitKeys(item, ['id', 'extras', 'plugins', 'routes', 'targets', 'credentials']),
            { keepPut: true }
          )
          responseData[entity].imported++
        } catch (e: any) {
          pushFail(responseData, entity, e)
        }
      }
    }
  }

  return responseData
}
