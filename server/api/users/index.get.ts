import { prisma } from '../../utils/prisma'
import { requireAdmin } from '../../utils/session'
import { publicUser } from '../../utils/users'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } })
  return { data: users.map(publicUser) }
})
