import { ZodError, z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAdmin } from '../../utils/session'

const bodySchema = z.object({
  cron: z.string().min(5).max(100),
  connectionId: z.string().min(1),
  active: z.boolean().optional().default(true)
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

  const connection = await prisma.kongNode.findUnique({ where: { id: body.connectionId } })
  if (!connection) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid connection' })
  }

  const created = await prisma.snapshotSchedule.create({
    data: {
      cron: body.cron.trim(),
      connectionId: body.connectionId,
      active: body.active
    },
    include: {
      connection: { select: { id: true, name: true, kongAdminUrl: true } }
    }
  })
  return { data: created }
})
