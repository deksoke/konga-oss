import { prisma } from '../../utils/prisma'
import { requireAdmin } from '../../utils/session'
import { mergeSettings } from '../../utils/settings'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const row = await prisma.appSettings.findUnique({ where: { id: 'default' } })
  return { data: mergeSettings(row?.data) }
})
