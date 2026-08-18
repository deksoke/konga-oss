import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata'
])

function ipv4ToInt(ip: string) {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0
}

function isPrivateOrLocalIp(ip: string): boolean {
  if (ip.includes(':')) {
    const normalized = ip.toLowerCase()
    if (normalized === '::1') return true
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true // ULA
    if (normalized.startsWith('fe80')) return true // link-local
    // IPv4-mapped
    if (normalized.startsWith('::ffff:')) {
      return isPrivateOrLocalIp(normalized.slice(7))
    }
    return false
  }

  const n = ipv4ToInt(ip)
  const ranges: Array<[number, number]> = [
    [ipv4ToInt('0.0.0.0'), ipv4ToInt('0.255.255.255')],
    [ipv4ToInt('10.0.0.0'), ipv4ToInt('10.255.255.255')],
    [ipv4ToInt('127.0.0.0'), ipv4ToInt('127.255.255.255')],
    [ipv4ToInt('169.254.0.0'), ipv4ToInt('169.254.255.255')],
    [ipv4ToInt('172.16.0.0'), ipv4ToInt('172.31.255.255')],
    [ipv4ToInt('192.168.0.0'), ipv4ToInt('192.168.255.255')],
    [ipv4ToInt('100.64.0.0'), ipv4ToInt('100.127.255.255')]
  ]
  return ranges.some(([a, b]) => n >= a && n <= b)
}

/**
 * Validate Kong Admin URL to reduce SSRF risk.
 * In development, private IPs are allowed (Docker/Kong on LAN).
 * Set KONGA_ALLOW_PRIVATE_ADMIN_URL=false in production to block RFC1918/link-local.
 */
export async function assertSafeKongAdminUrl(raw: string) {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Kong Admin URL' })
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw createError({ statusCode: 400, statusMessage: 'Kong Admin URL must be http or https' })
  }

  if (url.username || url.password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Kong Admin URL must not include credentials'
    })
  }

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!host || BLOCKED_HOSTNAMES.has(host)) {
    throw createError({ statusCode: 400, statusMessage: 'Kong Admin host is not allowed' })
  }

  const allowPrivate =
    process.env.KONGA_ALLOW_PRIVATE_ADMIN_URL === 'true' ||
    (process.env.KONGA_ALLOW_PRIVATE_ADMIN_URL !== 'false' && process.env.NODE_ENV !== 'production')

  const ips: string[] = []
  if (isIP(host)) {
    ips.push(host)
  } else {
    try {
      const records = await lookup(host, { all: true, verbatim: true })
      for (const r of records) ips.push(r.address)
    } catch {
      throw createError({ statusCode: 400, statusMessage: 'Kong Admin host could not be resolved' })
    }
  }

  if (!ips.length) {
    throw createError({ statusCode: 400, statusMessage: 'Kong Admin host could not be resolved' })
  }

  if (!allowPrivate && ips.some(isPrivateOrLocalIp)) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Kong Admin URL resolves to a private/local address. Set KONGA_ALLOW_PRIVATE_ADMIN_URL=true only if intentional.'
    })
  }

  // Normalize: no trailing slash clutter for storage
  return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}${url.search}`
}

export function isSafeExternalWebhookUrl(raw: string, allowedHosts: string[]) {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return false
    if (url.username || url.password) return false
    const host = url.hostname.toLowerCase()
    return allowedHosts.some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

export function isSafeHostname(value: string) {
  return /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/i.test(value)
}
