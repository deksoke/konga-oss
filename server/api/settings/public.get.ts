import { prisma } from '../../utils/prisma'
import { mergeSettings } from '../../utils/settings'

/** Unauthenticated — only non-sensitive values safe for health checks / login page. */
export default defineEventHandler(async () => {
  const row = await prisma.appSettings.findUnique({ where: { id: 'default' } })
  const settings = mergeSettings(row?.data)
  return {
    data: {
      info_polling_interval: settings.info_polling_interval,
      signup_enable: settings.signup_enable
    }
  }
})
