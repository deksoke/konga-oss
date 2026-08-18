import { requireUser } from '../../utils/session'
import { getActiveNodeForUser, kongRequest } from '../../utils/kong'

/** GET /api/kong → Kong Admin root (/) */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const node = await getActiveNodeForUser(user.id, user.activeNodeId)
  return kongRequest(node, 'GET', '/')
})
