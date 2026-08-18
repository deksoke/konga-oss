import { ZodError, z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../../utils/prisma'
import { requireAdmin } from '../../utils/session'
import { publicUser } from '../../utils/users'

const bodySchema = z.object({
  username: z.string().min(3).max(64),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  password_confirmation: z.string().min(8).max(128),
  firstName: z.string().max(128).optional().default(''),
  lastName: z.string().max(128).optional().default(''),
  active: z.boolean().optional().default(true),
  admin: z.boolean().optional().default(false)
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

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

  const passwordHash = await bcrypt.hash(body.password, 12)
  try {
    const user = await prisma.user.create({
      data: {
        username: body.username.trim(),
        email: body.email.trim().toLowerCase(),
        passwordHash,
        firstName: body.firstName?.trim() || '',
        lastName: body.lastName?.trim() || '',
        active: body.active,
        role: body.admin ? 'admin' : 'user',
        theme: 'auto'
      }
    })
    return { data: publicUser(user) }
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'Username or email already exists' })
    }
    throw err
  }
})
