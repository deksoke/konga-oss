import { requireUser } from '../../utils/session'
import { prisma } from '../../utils/prisma'
import { maskNode } from '../../utils/kong'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const nodes = await prisma.kongNode.findMany({ orderBy: { createdAt: 'desc' } })
  return {
    data: nodes.map((n) => ({
      ...maskNode(n),
      createdAt: n.createdAt,
      updatedAt: n.updatedAt
    }))
  }
})
