import { ZodError, z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../../utils/prisma'
import { requireUser, setUserSession, toSessionUser } from '../../utils/session'
import { publicUser } from '../../utils/users'

const bodySchema = z.object({
  username: z.string().min(3).max(64).optional(),
  email: z.string().email().optional(),
  firstName: z.string().max(128).optional(),
  lastName: z.string().max(128).optional(),
  active: z.boolean().optional(),
  admin: z.boolean().optional(),
  activeNodeId: z.string().nullable().optional(),
  password: z.string().min(8).max(128).optional(),
  password_confirmation: z.string().min(8).max(128).optional()
})

export default defineEventHandler(async (event) => {
  const session = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const isAdmin = session.role === 'admin'
  const isSelf = session.id === id
  if (!isAdmin && !isSelf) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
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

  if (!isAdmin && (body.admin !== undefined || body.active !== undefined || body.activeNodeId !== undefined)) {
    throw createError({ statusCode: 403, statusMessage: 'Only admins can change role/active/connection' })
  }

  if (body.password) {
    if (body.password !== body.password_confirmation) {
      throw createError({ statusCode: 400, statusMessage: 'Passwords do not match' })
    }
  }

  const data: Record<string, unknown> = {}
  if (body.username !== undefined) data.username = body.username.trim()
  if (body.email !== undefined) data.email = body.email.trim().toLowerCase()
  if (body.firstName !== undefined) data.firstName = body.firstName.trim()
  if (body.lastName !== undefined) data.lastName = body.lastName.trim()
  if (isAdmin && body.active !== undefined) {
    if (isSelf && body.active === false) {
      throw createError({ statusCode: 400, statusMessage: 'You cannot deactivate your own account' })
    }
    data.active = body.active
  }
  if (isAdmin && body.admin !== undefined) {
    if (isSelf && !body.admin) {
      throw createError({ statusCode: 400, statusMessage: 'You cannot remove your own admin role' })
    }
    data.role = body.admin ? 'admin' : 'user'
  }
  if (isAdmin && body.activeNodeId !== undefined) data.activeNodeId = body.activeNodeId
  if (body.password) data.passwordHash = await bcrypt.hash(body.password, 12)

  try {
    const user = await prisma.user.update({ where: { id }, data })
    if (isSelf) {
      await setUserSession(event, toSessionUser(user))
    }
    return { data: publicUser(user) }
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'Username or email already exists' })
    }
    if (err?.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }
    throw err
  }
})
