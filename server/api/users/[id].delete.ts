import { prisma } from '../../utils/prisma'
import { requireAdmin } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  if (id === session.id) {
    throw createError({ statusCode: 400, statusMessage: 'You cannot delete your own account' })
  }

  try {
    await prisma.user.delete({ where: { id } })
    return { ok: true }
  } catch (err: any) {
    if (err?.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }
    throw err
  }
})
