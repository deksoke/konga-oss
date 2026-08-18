import { prisma } from '../../utils/prisma'
import { mergeSettings } from '../../utils/settings'

export default defineEventHandler(async () => {
  const count = await prisma.user.count()
  const settingsRow = await prisma.appSettings.findUnique({ where: { id: 'default' } })
  const settings = mergeSettings(settingsRow?.data)
  return {
    needsBootstrap: count === 0,
    signupEnabled: count === 0 || settings.signup_enable
  }
})
