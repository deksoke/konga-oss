import { requireAdmin } from '../../../../utils/session'
import { loadAppSettings, sendLineNotification } from '../../../../utils/notify'
import { lineTestErrorMessage } from '../../../../../utils/lineMessaging'

function asciiStatusMessage(text: string) {
  const ascii = text.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim()
  return ascii.slice(0, 250) || 'LINE Messaging API failed'
}

/** Send a test LINE message using the saved integration config. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const settings = await loadAppSettings()
  const result = await sendLineNotification(
    settings,
    `[ ${new Date().toLocaleString()} ] [Konga] LINE Official integration test — if you see this, Messaging API is working.`
  )
  if (!result.ok) {
    const message = lineTestErrorMessage(result)
    throw createError({
      statusCode: 400,
      statusMessage: asciiStatusMessage(message),
      message
    })
  }
  return { ok: true }
})
