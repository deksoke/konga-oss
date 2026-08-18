import { ZodError, z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../../utils/prisma'
import { setUserSession, toSessionUser } from '../../utils/session'
import { requireServerEnv } from '../../utils/env'
import { mergeSettings } from '../../utils/settings'
import { clientIp, rateLimit } from '../../utils/rateLimit'

const bodySchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(64),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128)
})

export default defineEventHandler(async (event) => {
  requireServerEnv()

  const ip = clientIp(event)
  const limited = rateLimit(`register:${ip}`, 5, 15 * 60_000)
  if (!limited.ok) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many registration attempts. Try again later.',
      data: { retryAfterMs: limited.retryAfterMs }
    })
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await readBody(event))
  } catch (err) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: err.errors.map((e) => e.message).join(', ')
      })
    }
    throw err
  }

  const settingsRow = await prisma.appSettings.findUnique({ where: { id: 'default' } })
  const settings = mergeSettings(settingsRow?.data)

  // Serialize bootstrap: advisory lock via transaction on AppSettings row
  const passwordHash = await bcrypt.hash(body.password, 12)
  let result
  try {
    result = await prisma.$transaction(async (tx) => {
      // Lock settings row (or create) to serialize first-user creation
      const existing = await tx.appSettings.findUnique({ where: { id: 'default' } })
      if (!existing) {
        await tx.appSettings.create({ data: { id: 'default', data: settings } })
      } else {
        await tx.appSettings.update({
          where: { id: 'default' },
          data: { updatedAt: new Date() }
        })
      }

      const existingCount = await tx.user.count()
      if (existingCount > 0 && !settings.signup_enable) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Registration closed. An administrator already exists. Please sign in.'
        })
      }

      const isBootstrap = existingCount === 0
      const requireActivation = !isBootstrap && settings.signup_require_activation

      return tx.user.create({
        data: {
          username: body.username.trim(),
          email: body.email.trim().toLowerCase(),
          passwordHash,
          role: isBootstrap ? 'admin' : 'user',
          active: !requireActivation,
          theme: 'auto'
        }
      })
    })
  } catch (err: any) {
    if (err?.statusCode) throw err
    if (err?.code === 'P2002') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Username or email already exists'
      })
    }
    console.error('[auth/register] create failed', err?.message || err)
    throw createError({
      statusCode: 500,
      statusMessage: 'Could not create account'
    })
  }

  if (!result.active) {
    return {
      user: null,
      pendingActivation: true,
      message: 'Account created. An administrator must activate it before you can sign in.'
    }
  }

  const sessionUser = toSessionUser(result)
  await setUserSession(event, sessionUser)
  return { user: sessionUser }
})
