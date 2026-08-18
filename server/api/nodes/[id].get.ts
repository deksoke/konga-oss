import { requireUser } from '../../utils/session'
import { prisma } from '../../utils/prisma'
import { maskNode } from '../../utils/kong'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = getRouterParam(event, 'id')
  const node = await prisma.kongNode.findUnique({ where: { id } })
  if (!node) {
    throw createError({ statusCode: 404, statusMessage: 'Node not found' })
  }
  return {
    data: {
      ...maskNode(node),
      createdAt: node.createdAt,
      updatedAt: node.updatedAt
    }
  }
})
