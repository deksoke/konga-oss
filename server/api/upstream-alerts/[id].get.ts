import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/session'
import { getActiveNodeForUser } from '../../utils/kong'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const upstreamId = getRouterParam(event, 'id')
  if (!upstreamId) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  if (!user.activeNodeId) {
    throw createError({ statusCode: 400, statusMessage: 'No active Kong node selected' })
  }

  const alert = await prisma.upstreamAlert.findUnique({
    where: {
      upstreamId_connectionId: {
        upstreamId,
        connectionId: user.activeNodeId
      }
    }
  })

  return {
    data: alert || {
      upstreamId,
      connectionId: user.activeNodeId,
      active: false,
      email: false,
      slack: true,
      discord: true,
      line: true
    }
  }
})
