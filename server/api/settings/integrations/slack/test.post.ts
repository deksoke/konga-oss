import { requireAdmin } from '../../../../utils/session'
import { loadAppSettings, sendSlackNotification } from '../../../../utils/notify'

/** Send a test Slack message using the saved integration config. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const settings = await loadAppSettings()
  const result = await sendSlackNotification(
    settings,
    `[ ${new Date().toLocaleString()} ] *[Konga]* Slack integration test — if you see this, webhooks are working.`
  )
  if (!result.ok) {
    const message =
      result.reason === 'disabled_or_missing'
        ? 'Enable Slack and save a webhook URL first'
        : result.reason === 'invalid_url'
          ? 'Webhook URL must be an https://hooks.slack.com/... URL'
          : `Slack webhook failed${'status' in result ? ` (HTTP ${result.status})` : ''}`
    throw createError({ statusCode: 400, statusMessage: message })
  }
  return { ok: true }
})
