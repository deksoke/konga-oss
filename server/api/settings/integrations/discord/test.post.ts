import { requireAdmin } from '../../../../utils/session'
import { loadAppSettings, sendDiscordNotification } from '../../../../utils/notify'

/** Send a test Discord message using the saved integration config. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const settings = await loadAppSettings()
  const result = await sendDiscordNotification(
    settings,
    `[ ${new Date().toLocaleString()} ] **[Konga]** Discord integration test — if you see this, webhooks are working.`
  )
  if (!result.ok) {
    const message =
      result.reason === 'disabled_or_missing'
        ? 'Enable Discord and save a webhook URL first'
        : result.reason === 'invalid_url'
          ? 'Webhook URL must be an https://discord.com/api/webhooks/... URL'
          : `Discord webhook failed${'status' in result ? ` (HTTP ${result.status})` : ''}`
    throw createError({ statusCode: 400, statusMessage: message })
  }
  return { ok: true }
})
