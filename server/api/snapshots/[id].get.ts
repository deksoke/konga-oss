import { prisma } from '../../utils/prisma'
import { requireAdmin } from '../../utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const snap = await prisma.snapshot.findUnique({ where: { id } })
  if (!snap) throw createError({ statusCode: 404, statusMessage: 'Snapshot not found' })
  return { data: snap }
})
