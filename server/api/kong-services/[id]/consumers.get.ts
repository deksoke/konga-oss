import { requireUser } from '../../../utils/session'
import { getActiveNodeForUser } from '../../../utils/kong'
import { eligibleConsumersForEntity } from '../../../utils/eligible'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  const node = await getActiveNodeForUser(user.id, user.activeNodeId)
  return eligibleConsumersForEntity(node, 'services', id)
})
