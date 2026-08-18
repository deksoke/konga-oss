import { requireAdmin } from '../../utils/session'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  await prisma.kongNode.delete({ where: { id } }).catch(() => {
    throw createError({ statusCode: 404, statusMessage: 'Node not found' })
  })
  return { ok: true }
})
