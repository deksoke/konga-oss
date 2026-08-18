import { ZodError, z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAdmin } from '../../utils/session'
import { mergeSettings } from '../../utils/settings'

const permSchema = z.object({
  create: z.boolean(),
  read: z.boolean(),
  update: z.boolean(),
  delete: z.boolean()
})

const smtpSettingsSchema = z.object({
  host: z.string().max(512),
  port: z.union([z.string().max(16), z.number()]).transform(String),
  auth: z.object({
    user: z.string().max(256),
    pass: z.string().max(512)
  }),
  secure: z.boolean()
})

const mailgunSettingsSchema = z.object({
  auth: z.object({
    api_key: z.string().max(512),
    domain: z.string().max(256)
  })
})

const sendmailSettingsSchema = z.object({
  sendmail: z.boolean()
})

const transportSchema = z.object({
  name: z.enum(['smtp', 'sendmail', 'mailgun']),
  description: z.string().max(512).optional(),
  settings: z.union([smtpSettingsSchema, mailgunSettingsSchema, sendmailSettingsSchema, z.record(z.any())])
})

const bodySchema = z
  .object({
    signup_enable: z.boolean().optional(),
    signup_require_activation: z.boolean().optional(),
    // 0 = disable polling (matches UI help text)
    info_polling_interval: z.number().int().min(0).max(3600_000).optional(),
    baseUrl: z.string().max(2048).optional(),
    email_default_sender_name: z.string().max(128).optional(),
    email_default_sender: z.string().max(256).optional(),
    email_notifications: z.boolean().optional(),
    default_transport: z.enum(['smtp', 'sendmail', 'mailgun']).nullable().optional(),
    email_transports: z.array(transportSchema).max(10).optional(),
    notify_when: z.record(z.any()).optional(),
    integrations: z.array(z.record(z.any())).max(20).optional(),
    user_permissions: z.record(permSchema).optional()
  })
  .strict()

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await readBody(event))
  } catch (err) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
      })
    }
    throw err
  }

  const current = await prisma.appSettings.findUnique({ where: { id: 'default' } })
  const merged = mergeSettings({ ...(current?.data as object), ...body })

  if ('default_transport' in body || 'email_transports' in body) {
    merged.email_notifications = Boolean(merged.default_transport)
  }

  const row = await prisma.appSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', data: merged },
    update: { data: merged }
  })
  return { data: mergeSettings(row.data) }
})
