import { prisma } from '../../../utils/prisma'
import { requireUser } from '../../../utils/session'
import { OAUTH_PROVIDERS } from '../../../utils/oauth'

export default defineEventHandler(async (event) => {
  const session = await requireUser(event)
  const rows = await prisma.userOAuthAccount.findMany({
    where: { userId: session.id },
    select: { provider: true, createdAt: true }
  })
  const linked = Object.fromEntries(OAUTH_PROVIDERS.map((id) => [id, false])) as Record<string, boolean>
  for (const row of rows) linked[row.provider] = true
  return { linked }
})
