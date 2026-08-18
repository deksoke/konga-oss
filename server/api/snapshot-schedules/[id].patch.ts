import { ZodError, z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAdmin } from '../../utils/session'

const bodySchema = z.object({
  cron: z.string().min(5).max(100).optional(),
  connectionId: z.string().optional(),
  active: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

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

  if (body.connectionId) {
    const connection = await prisma.kongNode.findUnique({ where: { id: body.connectionId } })
    if (!connection) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid connection' })
    }
  }

  try {
    const updated = await prisma.snapshotSchedule.update({
      where: { id },
      data: {
        ...(body.cron !== undefined ? { cron: body.cron.trim() } : {}),
        ...(body.connectionId !== undefined ? { connectionId: body.connectionId } : {}),
        ...(body.active !== undefined ? { active: body.active } : {})
      },
      include: {
        connection: { select: { id: true, name: true, kongAdminUrl: true } }
      }
    })
    return { data: updated }
  } catch (err: any) {
    if (err?.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: 'Schedule not found' })
    }
    throw err
  }
})
