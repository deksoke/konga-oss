import { prisma } from '../../utils/prisma'
import { requireAdmin } from '../../utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const rows = await prisma.snapshot.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      kongNodeName: true,
      kongNodeUrl: true,
      kongVersion: true,
      createdAt: true,
      updatedAt: true
    }
  })
  return { data: rows }
})
