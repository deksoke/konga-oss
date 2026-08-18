import { requireUser, setUserSession, toSessionUser } from '../../../utils/session'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await requireUser(event)
  const id = getRouterParam(event, 'id')
  const node = await prisma.kongNode.findUnique({ where: { id } })
  if (!node) {
    throw createError({ statusCode: 404, statusMessage: 'Node not found' })
  }

  const user = await prisma.user.update({
    where: { id: session.id },
    data: { activeNodeId: node.id }
  })

  const next = toSessionUser(user)
  await setUserSession(event, next)
  return { user: next }
})
