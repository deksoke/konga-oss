import { requireAdmin } from '../../../../utils/session'
import { lineApiFetch } from '../../../../utils/lineApi'
import { loadAppSettings } from '../../../../utils/notify'
import {
  LINE_FOLLOWERS_CAP,
  LINE_FOLLOWERS_IDS_URL,
  isValidLineChannelAccessToken,
  isValidLineDestinationId,
  lineFieldValue,
  lineProfileUrl
} from '../../../../../utils/lineMessaging'

/** Fetch follower ids (capped) plus display names. Does not persist the full list. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const settings = await loadAppSettings()
  const config = settings.integrations.find((i) => i.id === 'line')?.config
  const token = lineFieldValue(config, 'line_channel_access_token')
  if (!token || !isValidLineChannelAccessToken(token)) {
    throw createError({ statusCode: 400, statusMessage: 'Save a Channel Access Token first' })
  }

  const ids: string[] = []
  let start: string | undefined
  while (ids.length < LINE_FOLLOWERS_CAP) {
    const url = new URL(LINE_FOLLOWERS_IDS_URL)
    url.searchParams.set('limit', String(Math.min(1000, LINE_FOLLOWERS_CAP - ids.length)))
    if (start) url.searchParams.set('start', start)
    const res = await lineApiFetch(url.toString(), token)
    if (!res.ok) {
      throw createError({
        statusCode: 400,
        statusMessage: `LINE followers API failed (HTTP ${res.status})`
      })
    }
    const data = (await res.json().catch(() => null)) as { userIds?: string[]; next?: string } | null
    const page = Array.isArray(data?.userIds) ? data.userIds : []
    for (const raw of page) {
      const id = String(raw || '').trim()
      if (!id || !isValidLineDestinationId(id) || ids.includes(id)) continue
      ids.push(id)
      if (ids.length >= LINE_FOLLOWERS_CAP) break
    }
    if (!data?.next || !page.length) break
    start = data.next
  }

  const users: Array<{ id: string; name: string }> = []
  for (const chunk of chunk(ids, 10)) {
    const rows = await Promise.all(
      chunk.map(async (id) => {
        const res = await lineApiFetch(lineProfileUrl(id), token)
        if (!res.ok) return { id, name: id }
        const data = (await res.json().catch(() => null)) as { displayName?: string } | null
        return { id, name: String(data?.displayName || id).trim() || id }
      })
    )
    users.push(...rows)
  }

  return { users }
})

function chunk<T>(items: T[], size: number) {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
