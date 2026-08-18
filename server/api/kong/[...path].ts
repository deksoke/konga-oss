import { requireUser } from '../../utils/session'
import { getActiveNodeForUser, kongRequest } from '../../utils/kong'
import { assertKongPermission } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  const method = event.method.toUpperCase()
  const user = await requireUser(event)

  const path = (getRouterParam(event, 'path') || '').replace(/^\/+/, '')
  await assertKongPermission(user.role, method, path)

  const query = getQuery(event)
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      for (const item of value) qs.append(key, String(item))
    } else {
      qs.set(key, String(value))
    }
  }
  const pathWithQuery = qs.toString() ? `${path}?${qs.toString()}` : path
  const node = await getActiveNodeForUser(user.id, user.activeNodeId)
  const body = ['GET', 'HEAD', 'DELETE'].includes(method) ? undefined : await readBody(event).catch(() => undefined)

  return kongRequest(node, method, pathWithQuery, body)
})
