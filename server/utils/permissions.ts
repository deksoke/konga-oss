import { prisma } from './prisma'
import { mergeSettings } from './settings'

export type PermissionAction = 'create' | 'read' | 'update' | 'delete'

const METHOD_ACTION: Record<string, PermissionAction | null> = {
  GET: 'read',
  HEAD: 'read',
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete'
}

const PATH_CONTEXT: Array<{ prefix: string; context: string }> = [
  { prefix: 'services', context: 'services' },
  { prefix: 'routes', context: 'routes' },
  { prefix: 'consumers', context: 'consumers' },
  { prefix: 'plugins', context: 'plugins' },
  { prefix: 'upstreams', context: 'upstreams' },
  { prefix: 'targets', context: 'upstreams' },
  { prefix: 'certificates', context: 'certificates' },
  { prefix: 'snis', context: 'certificates' },
  { prefix: 'acls', context: 'consumers' },
  { prefix: 'basic-auths', context: 'consumers' },
  { prefix: 'key-auths', context: 'consumers' },
  { prefix: 'hmac-auths', context: 'consumers' },
  { prefix: 'jwts', context: 'consumers' },
  { prefix: 'oauth2', context: 'consumers' }
]

/** Credential-bearing endpoints — deny-by-default for non-admins unless consumers.read */
const SENSITIVE_ROOTS = new Set([
  'basic-auths',
  'key-auths',
  'hmac-auths',
  'jwts',
  'oauth2',
  'certificates',
  'acls'
])

export function contextForKongPath(path: string): string | null {
  const root = path.replace(/^\/+/, '').split(/[/?]/)[0]
  if (!root) return null
  return PATH_CONTEXT.find((p) => p.prefix === root)?.context || null
}

export async function assertKongPermission(
  role: 'admin' | 'user',
  method: string,
  path: string
) {
  if (role === 'admin') return

  const action = METHOD_ACTION[method.toUpperCase()]
  if (!action) {
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
  }

  const cleanRoot = path.replace(/^\/+/, '').split(/[/?]/)[0] || ''
  // status / root info always readable when authenticated
  if ((cleanRoot === '' || cleanRoot === 'status') && action === 'read') return

  const context = contextForKongPath(path)
  if (!context) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const row = await prisma.appSettings.findUnique({ where: { id: 'default' } })
  const settings = mergeSettings(row?.data)
  const perms = settings.user_permissions?.[context]

  if (!perms?.[action]) {
    throw createError({
      statusCode: 403,
      statusMessage: `Missing permission: ${context}.${action}`
    })
  }

  // Extra gate: credential dumps require explicit consumers.read (already checked)
  // but never grant sensitive roots if somehow misconfigured without read
  if (SENSITIVE_ROOTS.has(cleanRoot) && !perms.read) {
    throw createError({ statusCode: 403, statusMessage: 'Missing permission: consumers.read' })
  }
}
