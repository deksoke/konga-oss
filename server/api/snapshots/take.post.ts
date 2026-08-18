import { ZodError, z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAdmin } from '../../utils/session'
import { getActiveNodeForUser } from '../../utils/kong'
import { takeKongSnapshot } from '../../utils/snapshots'

const bodySchema = z.object({
  name: z.string().max(200).optional(),
  nodeId: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
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

  let node
  if (body.nodeId) {
    node = await prisma.kongNode.findUnique({ where: { id: body.nodeId } })
    if (!node) throw createError({ statusCode: 400, statusMessage: 'Invalid Kong connection' })
  } else {
    node = await getActiveNodeForUser(session.id, session.activeNodeId)
  }

  const snap = await takeKongSnapshot(node, body.name)
  try {
    const created = await prisma.snapshot.create({
      data: {
        name: snap.name,
        kongNodeName: snap.kongNodeName,
        kongNodeUrl: snap.kongNodeUrl,
        kongVersion: snap.kongVersion,
        data: snap.data
      }
    })
    return {
      data: {
        id: created.id,
        name: created.name,
        kongNodeName: created.kongNodeName,
        kongNodeUrl: created.kongNodeUrl,
        kongVersion: created.kongVersion,
        createdAt: created.createdAt
      }
    }
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'Snapshot name already exists' })
    }
    throw err
  }
})
