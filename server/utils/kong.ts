import { SignJWT } from 'jose'
import type { KongAuthType } from '@prisma/client'
import type { KongCredentials } from './crypto'
import {
  CredentialsDecryptError,
  decryptCredentialsDetailed,
  encryptCredentials
} from './crypto'
import { prisma } from './prisma'

const ALLOWED_ROOT = new Set([
  'status',
  'services',
  'routes',
  'consumers',
  'plugins',
  'certificates',
  'upstreams',
  'snis',
  'targets',
  'acls',
  'basic-auths',
  'key-auths',
  'hmac-auths',
  'jwts',
  'oauth2'
])

export type KongNodeRecord = {
  id: string
  name: string
  kongAdminUrl: string
  authType: KongAuthType
  credentialsEnc: string
}

function unwrapCredentials(blob: string): KongCredentials {
  try {
    return decryptCredentialsDetailed(blob).credentials
  } catch (err) {
    if (err instanceof CredentialsDecryptError) {
      throw createError({
        statusCode: 422,
        statusMessage: err.message
      })
    }
    throw err
  }
}

/** Decrypt and, if needed, re-encrypt with the current NODE_CREDENTIALS_KEY. */
export async function resolveNodeCredentials(node: KongNodeRecord): Promise<KongCredentials> {
  try {
    const result = decryptCredentialsDetailed(node.credentialsEnc)
    if (result.needsReencrypt && node.id) {
      const next = encryptCredentials(result.credentials)
      await prisma.kongNode
        .update({
          where: { id: node.id },
          data: { credentialsEnc: next }
        })
        .catch((err) => console.warn('[kong] credential re-encrypt failed', err))
      node.credentialsEnc = next
    }
    return result.credentials
  } catch (err) {
    if (err instanceof CredentialsDecryptError) {
      throw createError({
        statusCode: 422,
        statusMessage: err.message
      })
    }
    throw err
  }
}

export function maskNode(node: KongNodeRecord & {
  healthChecks?: boolean
  healthCheckDetails?: unknown
  createdAt?: Date
  updatedAt?: Date
}) {
  let creds: KongCredentials = {}
  let credentialsBroken = false
  try {
    creds = unwrapCredentials(node.credentialsEnc)
  } catch {
    credentialsBroken = Boolean(node.credentialsEnc)
  }
  return {
    id: node.id,
    name: node.name,
    kongAdminUrl: node.kongAdminUrl,
    authType: node.authType,
    hasApiKey: Boolean(creds.apiKey),
    hasBasicAuth: Boolean(creds.username),
    hasJwt: Boolean(creds.jwtSecret || creds.jwtKey),
    credentialsBroken,
    healthChecks: Boolean(node.healthChecks),
    healthCheckDetails: node.healthCheckDetails || null,
    createdAt: undefined as unknown as Date
  }
}

function withoutTrailingSlash(url: string) {
  return url.replace(/\/+$/, '')
}

async function buildHeaders(authType: KongAuthType, creds: KongCredentials): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }

  switch (authType) {
    case 'key_auth':
      if (creds.apiKey) {
        headers.apikey = creds.apiKey
      }
      break
    case 'basic_auth': {
      const token = Buffer.from(`${creds.username || ''}:${creds.password || ''}`).toString('base64')
      headers.Authorization = `Basic ${token}`
      break
    }
    case 'jwt': {
      const secret = new TextEncoder().encode(creds.jwtSecret || 'invalid')
      const alg = creds.jwtAlgorithm || 'HS256'
      const jwt = await new SignJWT({})
        .setProtectedHeader({ alg, typ: 'JWT', ...(creds.jwtKey ? { kid: creds.jwtKey } : {}) })
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(secret)
      headers.Authorization = `Bearer ${jwt}`
      break
    }
    default:
      break
  }

  return headers
}

export function assertKongPathAllowed(path: string, method: string) {
  // Reject traversal / encoded dots before any normalization
  if (
    /%2e/i.test(path) ||
    path.includes('\\') ||
    path.includes('\0') ||
    /:\/\//.test(path)
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Kong path' })
  }

  let decoded = path
  try {
    decoded = decodeURIComponent(path)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Kong path encoding' })
  }

  if (decoded.includes('..') || decoded.includes('\\') || decoded.includes('\0')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Kong path' })
  }

  const withoutQuery = decoded.split('?')[0].replace(/^\/+/, '')
  if (withoutQuery === '' || withoutQuery === '/') {
    if (method.toUpperCase() !== 'GET') {
      throw createError({ statusCode: 405, statusMessage: 'Only GET / is allowed for root info' })
    }
    return
  }

  const segments = withoutQuery.split('/').filter((s) => s.length > 0)
  if (!segments.length || segments.some((s) => s === '.' || s === '..' || !s)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Kong path' })
  }

  // Kong entity IDs / names / health verbs: conservative charset only
  for (const seg of segments) {
    if (!/^[A-Za-z0-9._~:@=-]+$/.test(seg)) {
      throw createError({ statusCode: 400, statusMessage: `Invalid Kong path segment: ${seg}` })
    }
  }

  const entity = segments[0]
  if (!ALLOWED_ROOT.has(entity)) {
    throw createError({ statusCode: 403, statusMessage: `Entity not allowed: ${entity}` })
  }
}

export function sanitizeKongEntityId(id: string) {
  if (!id || !/^[A-Za-z0-9._~-]+$/.test(id) || id.includes('..')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid entity id' })
  }
  return id
}

export async function getActiveNodeForUser(userId: string, activeNodeId: string | null) {
  if (!activeNodeId) {
    throw createError({ statusCode: 400, statusMessage: 'No active Kong node selected' })
  }
  const node = await prisma.kongNode.findUnique({ where: { id: activeNodeId } })
  if (!node) {
    throw createError({ statusCode: 400, statusMessage: 'Active Kong node not found' })
  }
  return node
}

export async function kongRequest(
  node: KongNodeRecord,
  method: string,
  path: string,
  body?: unknown,
  options?: { keepPut?: boolean }
) {
  assertKongPathAllowed(path, method)
  const creds = await resolveNodeCredentials(node)
  const headers = await buildHeaders(node.authType, creds)

  const base = withoutTrailingSlash(node.kongAdminUrl)
  const relative = path.replace(/^\/+/, '')
  let url: URL
  try {
    url = new URL(relative, `${base}/`)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Kong request URL' })
  }
  const baseUrl = new URL(`${base}/`)
  if (url.origin !== baseUrl.origin || !url.pathname.startsWith(baseUrl.pathname.replace(/\/$/, '') || '/')) {
    // Ensure we never escape the admin origin
    if (url.origin !== new URL(base).origin) {
      throw createError({ statusCode: 400, statusMessage: 'Kong request URL escaped admin origin' })
    }
  }

  const methodUpper = method.toUpperCase()
  const cleanPath = relative.split('?')[0]
  // Keep PUT for target health, restore upserts, consumer credentials; map other PUTs to PATCH
  const isHealthPut = /\/targets\/[^/]+\/(healthy|unhealthy)$/.test(cleanPath)
  const isCredentialPut =
    /\/consumers\/[^/]+\/(basic-auth|key-auth|hmac-auth|jwt|oauth2)\//.test(cleanPath)
  const finalMethod =
    methodUpper === 'PUT' && !isHealthPut && !isCredentialPut && !options?.keepPut
      ? 'PATCH'
      : methodUpper

  const res = await fetch(url.toString(), {
    method: finalMethod,
    headers,
    redirect: 'error',
    body:
      body !== undefined && finalMethod !== 'GET' && finalMethod !== 'DELETE'
        ? JSON.stringify(body)
        : finalMethod === 'PUT' && isHealthPut
          ? JSON.stringify({})
          : undefined
  })

  const contentType = res.headers.get('content-type') || ''
  const text = await res.text()

  if (!text) {
    if (!res.ok) {
      throw createError({
        statusCode: res.status,
        statusMessage: 'Kong Admin API error'
      })
    }
    return null
  }

  if (!contentType.includes('application/json')) {
    throw createError({
      statusCode: 502,
      statusMessage:
        'Kong Admin URL did not return JSON. Check the node URL points at Kong Admin API (port 8001), not a web page.'
    })
  }

  let data: unknown = null
  try {
    data = JSON.parse(text)
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'Kong Admin returned invalid JSON'
    })
  }

  if (!res.ok) {
    throw createError({
      statusCode: res.status,
      statusMessage: 'Kong Admin API error',
      data
    })
  }

  return data
}
