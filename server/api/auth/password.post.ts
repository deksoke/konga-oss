import { ZodError, z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/session'
import { clientIp, rateLimit } from '../../utils/rateLimit'

const bodySchema = z.object({
  current_password: z.string().min(1).max(128),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  password_confirmation: z.string().min(8).max(128)
})

export default defineEventHandler(async (event) => {
  const session = await requireUser(event)

  const ip = clientIp(event)
  const limited = rateLimit(`password:${session.id}:${ip}`, 10, 15 * 60_000)
  if (!limited.ok) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many password change attempts. Try again later.',
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

  if (body.password !== body.password_confirmation) {
    throw createError({ statusCode: 400, statusMessage: 'Passwords do not match' })
  }

  if (body.password === body.current_password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'New password must be different from the current password'
    })
  }

  const user = await prisma.user.findUnique({ where: { id: session.id } })
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const ok = await bcrypt.compare(body.current_password, user.passwordHash)
  if (!ok) {
    throw createError({ statusCode: 400, statusMessage: 'Current password is incorrect' })
  }

  const passwordHash = await bcrypt.hash(body.password, 12)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash }
  })

  return { ok: true, message: 'Password updated' }
})
