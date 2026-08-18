import { requireUser, setUserSession, toSessionUser } from '../../utils/session'
import { prisma } from '../../utils/prisma'

/** Clear the user's active Kong node (DEACTIVATE). */
export default defineEventHandler(async (event) => {
  const session = await requireUser(event)
  const user = await prisma.user.update({
    where: { id: session.id },
    data: { activeNodeId: null }
  })

  const next = toSessionUser(user)
  await setUserSession(event, next)
  return { user: next }
})
