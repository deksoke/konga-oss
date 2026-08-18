import { ZodError, z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAdmin } from '../../../utils/session'
import { getActiveNodeForUser } from '../../../utils/kong'
import { restoreKongSnapshot } from '../../../utils/snapshots'

const bodySchema = z.object({
  imports: z.array(z.string()).optional(),
  nodeId: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
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

  const snap = await prisma.snapshot.findUnique({ where: { id } })
  if (!snap) throw createError({ statusCode: 404, statusMessage: 'Snapshot not found' })

  let node
  if (body.nodeId) {
    node = await prisma.kongNode.findUnique({ where: { id: body.nodeId } })
    if (!node) throw createError({ statusCode: 400, statusMessage: 'Invalid Kong connection' })
  } else {
    node = await getActiveNodeForUser(session.id, session.activeNodeId)
  }

  const data = (snap.data || {}) as Record<string, any[]>
  const results = await restoreKongSnapshot(node, data, body.imports)
  return { data: results }
})
