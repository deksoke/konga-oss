import { getUserSession, toSessionUser } from '../../utils/session'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session) {
    return { user: null }
  }
  const user = await prisma.user.findUnique({ where: { id: session.id } })
  if (!user) {
    return { user: null }
  }
  return { user: toSessionUser(user) }
})
