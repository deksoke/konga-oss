import { prisma } from '../../../utils/prisma'
import { requireUser } from '../../../utils/session'
import { isOAuthProvider } from '../../../utils/oauth'

export default defineEventHandler(async (event) => {
  const session = await requireUser(event)
  const provider = getRouterParam(event, 'provider')
  if (!isOAuthProvider(provider)) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown provider' })
  }

  await prisma.userOAuthAccount.deleteMany({
    where: { userId: session.id, provider }
  })
  return { ok: true }
})
