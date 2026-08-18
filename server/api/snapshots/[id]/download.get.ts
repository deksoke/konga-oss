import { prisma } from '../../../utils/prisma'
import { requireAdmin } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const snap = await prisma.snapshot.findUnique({ where: { id } })
  if (!snap) throw createError({ statusCode: 404, statusMessage: 'Snapshot not found' })

  const payload = {
    name: snap.name,
    kong_node_name: snap.kongNodeName,
    kong_node_url: snap.kongNodeUrl,
    kong_version: snap.kongVersion,
    data: snap.data,
    createdAt: snap.createdAt
  }

  setHeader(event, 'Content-Type', 'application/json')
  setHeader(event, 'Content-Disposition', `attachment; filename="snapshot_${snap.id}.json"`)
  return payload
})
