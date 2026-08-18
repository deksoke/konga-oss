import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../../utils/prisma'
import { setUserSession, toSessionUser } from '../../utils/session'
import { requireServerEnv } from '../../utils/env'
import { clientIp, rateLimit } from '../../utils/rateLimit'

const bodySchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128)
})

export default defineEventHandler(async (event) => {
  requireServerEnv()

  const ip = clientIp(event)
  const limited = rateLimit(`login:${ip}`, 20, 15 * 60_000)
  if (!limited.ok) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many login attempts. Try again later.',
      data: { retryAfterMs: limited.retryAfterMs }
    })
  }

  const body = bodySchema.parse(await readBody(event))
  const userKey = `login-user:${body.username.toLowerCase()}`
  const userLimited = rateLimit(userKey, 10, 15 * 60_000)
  if (!userLimited.ok) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many login attempts. Try again later.',
      data: { retryAfterMs: userLimited.retryAfterMs }
    })
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: body.username }, { email: body.username.toLowerCase() }]
    }
  })

  // Constant-ish failure: always hash something when user missing
  const hash = user?.passwordHash || '$2a$12$invalidinvalidinvalidinvalidinvalidinv'
  const ok = await bcrypt.compare(body.password, hash)

  if (!user || !ok) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  if (!user.active) {
    throw createError({ statusCode: 403, statusMessage: 'Account is inactive' })
  }

  const sessionUser = toSessionUser(user)
  await setUserSession(event, sessionUser)
  return { user: sessionUser }
})
