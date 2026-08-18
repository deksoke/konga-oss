import { requireAdmin } from '../../../utils/session'
import { prisma } from '../../../utils/prisma'
import { kongRequest } from '../../../utils/kong'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }
  const node = await prisma.kongNode.findUnique({ where: { id } })
  if (!node) {
    throw createError({ statusCode: 404, statusMessage: 'Node not found' })
  }
  const info = await kongRequest(node, 'GET', '/')
  return { ok: true, info }
})
