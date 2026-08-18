import { prisma } from '../../utils/prisma'
import { requireAdmin } from '../../utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const rows = await prisma.snapshotSchedule.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      connection: { select: { id: true, name: true, kongAdminUrl: true } }
    }
  })
  return { data: rows }
})
