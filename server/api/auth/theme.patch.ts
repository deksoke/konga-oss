import { z } from 'zod'
import { requireUser, setUserSession, toSessionUser } from '../../utils/session'
import { prisma } from '../../utils/prisma'

const bodySchema = z.object({
  theme: z.enum(['day', 'night', 'auto'])
})

export default defineEventHandler(async (event) => {
  const session = await requireUser(event)
  const body = bodySchema.parse(await readBody(event))

  const user = await prisma.user.update({
    where: { id: session.id },
    data: { theme: body.theme }
  })

  const next = toSessionUser(user)
  await setUserSession(event, next)
  return { user: next }
})
