import { z } from 'zod'
import { requireAdmin } from '../../../../utils/session'
import { loadAppSettings, sendSmtpMail } from '../../../../utils/notify'
import type { SmtpTransportSettings } from '../../../../utils/settings'

const bodySchema = z
  .object({
    host: z.string().optional(),
    port: z.union([z.string(), z.number()]).optional(),
    secure: z.boolean().optional(),
    auth: z
      .object({
        user: z.string().optional(),
        pass: z.string().optional()
      })
      .optional()
  })
  .optional()

/** Send a test email via SMTP to the current admin (draft settings preferred). */
export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  if (!user.email) {
    throw createError({ statusCode: 400, statusMessage: 'Your admin account has no email address' })
  }

  const settings = await loadAppSettings()
  const body = bodySchema.parse((await readBody(event)) || {})
  const saved = settings.email_transports.find((t) => t.name === 'smtp')?.settings as
    | SmtpTransportSettings
    | undefined

  const smtp: SmtpTransportSettings = {
    host: String(body?.host ?? saved?.host ?? '').trim(),
    port: String(body?.port ?? saved?.port ?? '').trim(),
    secure: body?.secure ?? Boolean(saved?.secure),
    auth: {
      user: String(body?.auth?.user ?? saved?.auth?.user ?? '').trim(),
      pass: String(body?.auth?.pass ?? saved?.auth?.pass ?? '')
    }
  }

  if (!smtp.host || !smtp.port) {
    throw createError({ statusCode: 400, statusMessage: 'SMTP host and port are required' })
  }

  const result = await sendSmtpMail({
    settings,
    smtp,
    to: [user.email],
    subject: '[Konga] SMTP test',
    text: `[ ${new Date().toLocaleString()} ] Konga SMTP test — if you see this, email delivery is working.\n\nSent to: ${user.email}`
  })

  if (!result.ok) {
    throw createError({
      statusCode: 400,
      statusMessage: result.message
    })
  }

  return { ok: true, to: user.email, messageId: result.messageId }
})
