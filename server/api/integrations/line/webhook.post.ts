import { resolveLineRoom } from '../../../utils/lineApi'
import { loadAppSettings, patchLineIntegrationConfig } from '../../../utils/notify'
import { lineFieldValue, isValidLineDestinationId, type LineKnownRoom } from '../../../../utils/lineMessaging'
import { verifyLineSignature } from '../../../../utils/lineWebhookSignature'

type LineEventSource = {
  type?: string
  groupId?: string
  roomId?: string
}

type LineWebhookEvent = {
  type?: string
  source?: LineEventSource
}

/**
 * Public LINE Messaging API webhook (no session).
 * Verifies X-Line-Signature against the stored Channel Secret, then catalogs join/leave.
 */
export default defineEventHandler(async (event) => {
  const raw = await readRawBody(event)
  const signature = getHeader(event, 'x-line-signature')
  const settings = await loadAppSettings()
  const config = settings.integrations.find((i) => i.id === 'line')?.config
  const secret = lineFieldValue(config, 'line_channel_secret')

  if (!secret) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (!verifyLineSignature(raw || '', secret, signature)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  let parsed: { events?: LineWebhookEvent[] } = {}
  try {
    parsed = JSON.parse(typeof raw === 'string' ? raw : Buffer.from(raw || '').toString('utf8'))
  } catch {
    return { ok: true }
  }

  const token = lineFieldValue(config, 'line_channel_access_token')
  const events = Array.isArray(parsed.events) ? parsed.events : []

  for (const ev of events) {
    if (ev.type !== 'join' && ev.type !== 'leave') continue
    const source = ev.source || {}
    const kind = source.type === 'room' ? 'room' : source.type === 'group' ? 'group' : null
    const id = String((kind === 'room' ? source.roomId : source.groupId) || '').trim()
    if (!kind || !id || !isValidLineDestinationId(id)) continue

    if (ev.type === 'leave') {
      await patchLineIntegrationConfig((cfg) => {
        const known = (Array.isArray(cfg.line_known_rooms) ? cfg.line_known_rooms : []) as LineKnownRoom[]
        const selected = (Array.isArray(cfg.line_selected_room_ids) ? cfg.line_selected_room_ids : []) as string[]
        return {
          ...cfg,
          line_known_rooms: known.filter((row) => row.id !== id),
          line_selected_room_ids: selected.filter((row) => row !== id)
        }
      })
      continue
    }

    let room: LineKnownRoom = { id, name: id, kind }
    if (token) {
      try {
        const resolved = await resolveLineRoom(token, id)
        if (resolved) room = resolved
      } catch {
        // keep id as the label
      }
    }

    await patchLineIntegrationConfig((cfg) => {
      const known = Array.isArray(cfg.line_known_rooms) ? [...(cfg.line_known_rooms as LineKnownRoom[])] : []
      const idx = known.findIndex((row) => row.id === room.id)
      if (idx >= 0) known[idx] = room
      else known.push(room)
      return { ...cfg, line_known_rooms: known }
    })
  }

  return { ok: true }
})
