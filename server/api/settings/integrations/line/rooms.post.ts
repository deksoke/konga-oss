import { requireAdmin } from '../../../../utils/session'
import { resolveLineRoom } from '../../../../utils/lineApi'
import { loadAppSettings, patchLineIntegrationConfig } from '../../../../utils/notify'
import {
  isValidLineChannelAccessToken,
  isValidLineDestinationId,
  lineFieldValue,
  type LineKnownRoom
} from '../../../../../utils/lineMessaging'

/** Add a Group/Room ID to the LINE rooms catalog (group summary, then room). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = (await readBody(event)) || {}
  const id = String(body.id || '').trim()
  if (!id || !isValidLineDestinationId(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Enter a valid LINE Group or Room ID' })
  }

  const settings = await loadAppSettings()
  const config = settings.integrations.find((i) => i.id === 'line')?.config
  const token = lineFieldValue(config, 'line_channel_access_token')
  if (!token || !isValidLineChannelAccessToken(token)) {
    throw createError({ statusCode: 400, statusMessage: 'Save a Channel Access Token first' })
  }

  const room = await resolveLineRoom(token, id)
  if (!room) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Could not find a LINE group or room with that ID. Invite the Official Account and check the ID.'
    })
  }

  await patchLineIntegrationConfig((cfg) => {
    const known = Array.isArray(cfg.line_known_rooms) ? [...(cfg.line_known_rooms as LineKnownRoom[])] : []
    const idx = known.findIndex((row) => row.id === room.id)
    if (idx >= 0) known[idx] = room
    else known.push(room)
    return { ...cfg, line_known_rooms: known }
  })

  return { room }
})
