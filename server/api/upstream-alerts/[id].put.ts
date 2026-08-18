import { ZodError, z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAdmin } from '../../utils/session'

const bodySchema = z.object({
  active: z.boolean().optional(),
  email: z.boolean().optional(),
  slack: z.boolean().optional(),
  discord: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  const upstreamId = getRouterParam(event, 'id')
  if (!upstreamId) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  if (!user.activeNodeId) {
    throw createError({ statusCode: 400, statusMessage: 'No active Kong node selected' })
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse((await readBody(event)) || {})
  } catch (err) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: err.errors.map((e) => e.message).join(', ')
      })
    }
    throw err
  }

  const alert = await prisma.upstreamAlert.upsert({
    where: {
      upstreamId_connectionId: {
        upstreamId,
        connectionId: user.activeNodeId
      }
    },
    create: {
      upstreamId,
      connectionId: user.activeNodeId,
      active: body.active ?? false,
      email: body.email ?? false,
      slack: body.slack ?? true,
      discord: body.discord ?? true
    },
    update: {
      ...(body.active !== undefined ? { active: body.active } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.slack !== undefined ? { slack: body.slack } : {}),
      ...(body.discord !== undefined ? { discord: body.discord } : {})
    }
  })

  return { data: alert }
})
