import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/session'
import { publicUser } from '../../utils/users'

export default defineEventHandler(async (event) => {
  const session = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  if (session.role !== 'admin' && session.id !== id) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })
  return { data: publicUser(user) }
})
