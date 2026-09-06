import { requireAdmin } from '../../../../utils/session'
import { loadAppSettings, sendLineNotification } from '../../../../utils/notify'

/** Send a test LINE message using the saved integration config. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const settings = await loadAppSettings()
  const result = await sendLineNotification(
    settings,
    `[ ${new Date().toLocaleString()} ] [Konga] LINE Official integration test — if you see this, Messaging API is working.`
  )
  if (!result.ok) {
    const message =
      result.reason === 'disabled'
        ? 'Enable LINE Official first'
        : result.reason === 'missing_token'
          ? 'Save a Channel Access Token first'
          : result.reason === 'invalid_token'
            ? 'Channel Access Token is invalid'
            : result.reason === 'empty_rooms'
              ? 'Select at least one group or room, or add a Group/Room ID'
              : result.reason === 'empty_users'
                ? 'Select at least one follower'
                : result.reason === 'invalid_mode'
                  ? 'Choose a LINE send mode (all followers, rooms, or users)'
                  : `LINE Messaging API failed${'status' in result && result.status ? ` (HTTP ${result.status})` : ''}`
    throw createError({ statusCode: 400, statusMessage: message })
  }
  return { ok: true }
})
