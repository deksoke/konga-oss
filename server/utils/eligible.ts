import { kongRequest, type KongNodeRecord } from './kong'
import { kongListAll } from './snapshots'

const AUTH_PLUGINS = ['jwt', 'basic-auth', 'key-auth', 'hmac-auth', 'oauth2'] as const

type Plugin = {
  id: string
  name: string
  enabled?: boolean
  service?: { id?: string } | null
  route?: { id?: string } | null
  consumer?: { id?: string } | null
  config?: { whitelist?: string[]; blacklist?: string[]; [key: string]: unknown }
}

function consumerIdOf(item: any): string | null {
  return item?.consumer?.id || item?.consumer_id || null
}

async function listCredsIfAvailable(node: KongNodeRecord, path: string) {
  try {
    return await kongListAll(node, path)
  } catch {
    return [] as any[]
  }
}

function pluginsForEntity(all: Plugin[], entity: 'service' | 'route', id: string) {
  return all.filter((p) => p.enabled !== false && p[entity]?.id === id)
}

export async function eligibleConsumersForEntity(
  node: KongNodeRecord,
  entity: 'services' | 'routes',
  entityId: string
) {
  const pluginsRes = (await kongRequest(node, 'GET', `${entity}/${entityId}/plugins?size=1000`)) as {
    data?: Plugin[]
  }
  let plugins = (pluginsRes.data || []).filter((p) => p.enabled !== false)
  if (!plugins.length) {
    return {
      total: 0,
      open: true,
      acl: null as Plugin | null,
      authenticationPlugins: [] as string[],
      data: [] as any[]
    }
  }

  const acl = plugins.find((p) => p.name === 'acl') || null
  const authenticationPlugins = plugins
    .filter((p) => AUTH_PLUGINS.includes(p.name as any))
    .map((p) => p.name)

  if (!acl && !authenticationPlugins.length) {
    return {
      total: 0,
      open: true,
      acl: null,
      authenticationPlugins,
      data: [] as any[]
    }
  }

  let aclConsumerIds: string[] | null = null
  if (acl) {
    const whitelist = (acl.config?.whitelist || []) as string[]
    const blacklist = (acl.config?.blacklist || []) as string[]
    const acls = await kongListAll(node, 'acls')
    const filtered = acls.filter(
      (item: any) => whitelist.includes(item.group) && !blacklist.includes(item.group)
    )
    aclConsumerIds = filtered.map((item: any) => consumerIdOf(item)).filter(Boolean) as string[]
    if (!aclConsumerIds.length) {
      return {
        total: 0,
        open: false,
        acl,
        authenticationPlugins,
        data: []
      }
    }
  }

  const has = (name: string) => plugins.some((p) => p.name === name)
  const [jwts, keyAuths, hmacAuths, oauth2, basicAuths] = await Promise.all([
    has('jwt') ? listCredsIfAvailable(node, 'jwts') : Promise.resolve([]),
    has('key-auth') ? listCredsIfAvailable(node, 'key-auths') : Promise.resolve([]),
    has('hmac-auth') ? listCredsIfAvailable(node, 'hmac-auths') : Promise.resolve([]),
    has('oauth2') ? listCredsIfAvailable(node, 'oauth2') : Promise.resolve([]),
    has('basic-auth') ? listCredsIfAvailable(node, 'basic-auths') : Promise.resolve([])
  ])

  const authConsumerIds = new Set<string>()
  for (const list of [jwts, keyAuths, hmacAuths, oauth2, basicAuths]) {
    for (const item of list) {
      const id = consumerIdOf(item)
      if (id) authConsumerIds.add(id)
    }
  }

  let consumerIds: string[]
  if (aclConsumerIds && authenticationPlugins.length) {
    consumerIds = aclConsumerIds.filter((id) => authConsumerIds.has(id))
  } else if (aclConsumerIds) {
    consumerIds = aclConsumerIds
  } else {
    consumerIds = [...authConsumerIds]
  }

  const consumers = await kongListAll(node, 'consumers')
  const eligible = consumers.filter((c: any) => consumerIds.includes(c.id))

  for (const consumer of eligible) {
    const creds: string[] = []
    if (keyAuths.some((i: any) => consumerIdOf(i) === consumer.id)) creds.push('key-auth')
    if (jwts.some((i: any) => consumerIdOf(i) === consumer.id)) creds.push('jwt')
    if (hmacAuths.some((i: any) => consumerIdOf(i) === consumer.id)) creds.push('hmac-auth')
    if (oauth2.some((i: any) => consumerIdOf(i) === consumer.id)) creds.push('oauth2')
    if (basicAuths.some((i: any) => consumerIdOf(i) === consumer.id)) creds.push('basic-auth')
    consumer.plugins = creds
  }

  return {
    total: eligible.length,
    open: false,
    acl,
    authenticationPlugins,
    data: eligible
  }
}

export async function accessibleServicesForConsumer(node: KongNodeRecord, consumerId: string) {
  const info = (await kongRequest(node, 'GET', '')) as {
    plugins?: { available_on_server?: Record<string, unknown> }
  }
  const available = info.plugins?.available_on_server || {}
  const hasPlugin = (name: string) => Boolean(available[name]) || name in available

  const [jwts, keyAuths, hmacAuths, oauth2, basicAuths, acls, services, routes, allPlugins] =
    await Promise.all([
      hasPlugin('jwt') ? listCredsIfAvailable(node, 'jwts') : Promise.resolve([]),
      hasPlugin('key-auth') ? listCredsIfAvailable(node, 'key-auths') : Promise.resolve([]),
      hasPlugin('hmac-auth') ? listCredsIfAvailable(node, 'hmac-auths') : Promise.resolve([]),
      hasPlugin('oauth2') ? listCredsIfAvailable(node, 'oauth2') : Promise.resolve([]),
      hasPlugin('basic-auth') ? listCredsIfAvailable(node, 'basic-auths') : Promise.resolve([]),
      kongListAll(node, `consumers/${consumerId}/acls`).catch(() => []),
      kongListAll(node, 'services'),
      kongListAll(node, 'routes'),
      kongListAll(node, 'plugins')
    ])

  const consumerAuths: string[] = []
  if (jwts.some((i: any) => consumerIdOf(i) === consumerId)) consumerAuths.push('jwt')
  if (keyAuths.some((i: any) => consumerIdOf(i) === consumerId)) consumerAuths.push('key-auth')
  if (hmacAuths.some((i: any) => consumerIdOf(i) === consumerId)) consumerAuths.push('hmac-auth')
  if (oauth2.some((i: any) => consumerIdOf(i) === consumerId)) consumerAuths.push('oauth2')
  if (basicAuths.some((i: any) => consumerIdOf(i) === consumerId)) consumerAuths.push('basic-auth')

  const consumerGroups = acls.map((a: any) => a.group)
  const enabledPlugins = (allPlugins as Plugin[]).filter((p) => p.enabled !== false)

  for (const service of services) {
    service.consumer_id = consumerId
    service.plugins = pluginsForEntity(enabledPlugins, 'service', service.id)
    service.acl = service.plugins.find((p: Plugin) => p.name === 'acl') || null
    service.auths = service.plugins
      .filter((p: Plugin) => AUTH_PLUGINS.includes(p.name as any))
      .map((p: Plugin) => p.name)
  }

  const open = services.filter((s: any) => !s.acl && !(s.auths || []).length)
  const matchingAuths = services.filter(
    (s: any) => intersection(s.auths || [], consumerAuths).length > 0
  )
  const whitelisted = services.filter(
    (s: any) => s.acl && intersection(s.acl.config?.whitelist || [], consumerGroups).length > 0
  )
  const whitelistedNoAuth = whitelisted.filter((s: any) => !(s.auths || []).length)

  let eligible =
    matchingAuths.length && whitelisted.length
      ? matchingAuths.filter((s: any) => whitelisted.includes(s))
      : matchingAuths.concat(whitelisted)
  eligible = uniqueById(eligible.concat(whitelistedNoAuth))

  const results = uniqueById(open.concat(eligible))

  for (const service of results) {
    const serviceRoutes = routes.filter((r: any) => r.service?.id === service.id)
    const eligibleRoutes: any[] = []
    for (const route of serviceRoutes) {
      const rPlugins = pluginsForEntity(enabledPlugins, 'route', route.id)
      const rAcl = rPlugins.find((p) => p.name === 'acl')
      const rAuths = rPlugins
        .filter((p) => AUTH_PLUGINS.includes(p.name as any))
        .map((p) => p.name)
      const openRoute = !rAcl && !rAuths.length
      const authOk = !rAuths.length || intersection(rAuths, consumerAuths).length > 0
      const aclOk =
        !rAcl || intersection((rAcl.config?.whitelist || []) as string[], consumerGroups).length > 0
      if (openRoute || (authOk && aclOk)) {
        route.plugins = rPlugins
        eligibleRoutes.push(route)
      }
    }
    service.routes = eligibleRoutes
  }

  const filtered = results.filter((s: any) => s.routes?.length)
  return { total: filtered.length, data: filtered }
}

function intersection<T>(a: T[], b: T[]) {
  return a.filter((x) => b.includes(x))
}

function uniqueById(items: any[]) {
  const seen = new Set<string>()
  const out: any[] = []
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}
