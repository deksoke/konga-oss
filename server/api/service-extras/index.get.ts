import { requireUser } from '../../utils/session'
import {
  getServiceExtra,
  listServiceExtrasMap,
  requireActiveConnectionId
} from '../../utils/serviceExtras'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const connectionId = await requireActiveConnectionId(user)
  const query = getQuery(event)
  const idsRaw = query.ids

  if (idsRaw !== undefined) {
    const ids = String(idsRaw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 2000)
    const map = await listServiceExtrasMap(connectionId, ids)
    const data: Record<string, { description: string }> = {}
    for (const id of ids) {
      data[id] = { description: map.get(id) || '' }
    }
    return { data }
  }

  const serviceId = String(query.serviceId || '')
  if (!serviceId) {
    throw createError({ statusCode: 400, statusMessage: 'serviceId or ids is required' })
  }
  const row = await getServiceExtra(connectionId, serviceId)
  return {
    data: {
      serviceId,
      description: row?.description || ''
    }
  }
})
