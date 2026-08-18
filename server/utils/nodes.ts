import { prisma } from './prisma'

/** Normalize for duplicate comparison (protocol/host/path, ignore trailing slash, case of host). */
export function kongAdminUrlKey(raw: string) {
  try {
    const url = new URL(raw)
    const host = url.host.toLowerCase()
    const path = url.pathname.replace(/\/+$/, '') || ''
    return `${url.protocol}//${host}${path}${url.search}`
  } catch {
    return raw.trim().toLowerCase()
  }
}

export async function assertUniqueKongAdminUrl(kongAdminUrl: string, excludeId?: string) {
  const key = kongAdminUrlKey(kongAdminUrl)
  const nodes = await prisma.kongNode.findMany({
    where: excludeId ? { id: { not: excludeId } } : undefined,
    select: { id: true, name: true, kongAdminUrl: true }
  })
  const duel = nodes.find((n) => kongAdminUrlKey(n.kongAdminUrl) === key)
  if (duel) {
    throw createError({
      statusCode: 409,
      statusMessage: `Kong Admin URL is already used by connection "${duel.name}"`
    })
  }
}
