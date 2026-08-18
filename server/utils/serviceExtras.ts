import { prisma } from './prisma'
import { getActiveNodeForUser } from './kong'
import type { SessionUser } from './session'

export async function requireActiveConnectionId(user: SessionUser) {
  const node = await getActiveNodeForUser(user.id, user.activeNodeId)
  return node.id
}

export async function getServiceExtra(connectionId: string, serviceId: string) {
  return prisma.kongServiceExtra.findUnique({
    where: {
      connectionId_serviceId: { connectionId, serviceId }
    }
  })
}

export async function upsertServiceExtra(
  connectionId: string,
  serviceId: string,
  data: { description?: string }
) {
  const description = (data.description ?? '').trim()
  return prisma.kongServiceExtra.upsert({
    where: {
      connectionId_serviceId: { connectionId, serviceId }
    },
    create: {
      connectionId,
      serviceId,
      description
    },
    update: {
      description
    }
  })
}

export async function listServiceExtrasMap(connectionId: string, serviceIds: string[]) {
  if (!serviceIds.length) return new Map<string, string>()
  const rows = await prisma.kongServiceExtra.findMany({
    where: {
      connectionId,
      serviceId: { in: serviceIds }
    },
    select: { serviceId: true, description: true }
  })
  return new Map(rows.map((r) => [r.serviceId, r.description || '']))
}

export async function deleteServiceExtra(connectionId: string, serviceId: string) {
  await prisma.kongServiceExtra.deleteMany({
    where: { connectionId, serviceId }
  })
}
