import { ZodError, z } from 'zod'
import { requireUser } from '../../utils/session'
import { requireActiveConnectionId, upsertServiceExtra } from '../../utils/serviceExtras'
import { sanitizeKongEntityId } from '../../utils/kong'

const bodySchema = z.object({
  serviceId: z.string().min(1),
  description: z.string().max(4000).optional().default('')
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const connectionId = await requireActiveConnectionId(user)

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await readBody(event))
  } catch (err) {
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: err.errors.map((e) => e.message).join(', ')
      })
    }
    throw err
  }

  const serviceId = sanitizeKongEntityId(body.serviceId)
  const row = await upsertServiceExtra(connectionId, serviceId, {
    description: body.description
  })

  return {
    data: {
      serviceId: row.serviceId,
      description: row.description
    }
  }
})
