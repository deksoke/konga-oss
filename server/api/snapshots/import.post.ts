import { ZodError, z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAdmin } from '../../utils/session'

const ALLOWED_ENTITY_KEYS = new Set([
  'services',
  'routes',
  'consumers',
  'plugins',
  'acls',
  'upstreams',
  'certificates',
  'snis',
  'basic-auths',
  'key-auths',
  'hmac-auths',
  'jwts',
  'oauth2'
])

const MAX_BODY_BYTES = 5 * 1024 * 1024 // 5 MiB
const MAX_ENTITIES_PER_KEY = 5000

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  kongNodeName: z.string().max(200).optional().default('imported'),
  kongNodeUrl: z.string().max(2048).optional().default(''),
  kongVersion: z.string().max(64).optional().default(''),
  data: z.record(z.array(z.any()))
})

function sanitizeSnapshotData(raw: Record<string, unknown[]>) {
  const out: Record<string, unknown[]> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!ALLOWED_ENTITY_KEYS.has(key)) continue
    if (!Array.isArray(value)) continue
    if (value.length > MAX_ENTITIES_PER_KEY) {
      throw createError({
        statusCode: 400,
        statusMessage: `Snapshot entity "${key}" exceeds ${MAX_ENTITIES_PER_KEY} items`
      })
    }
    out[key] = value
  }
  return out
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const contentLength = Number(getHeader(event, 'content-length') || 0)
  if (contentLength > MAX_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Snapshot payload too large' })
  }

  let body: z.infer<typeof bodySchema>
  try {
    const raw = await readBody(event)
    const approx = Buffer.byteLength(JSON.stringify(raw || {}), 'utf8')
    if (approx > MAX_BODY_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'Snapshot payload too large' })
    }
    body = bodySchema.parse(raw)
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    if (err instanceof ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: err.errors.map((e) => e.message).join(', ')
      })
    }
    throw err
  }

  const data = sanitizeSnapshotData(body.data)

  try {
    const created = await prisma.snapshot.create({
      data: {
        name: body.name.trim(),
        kongNodeName: body.kongNodeName || 'imported',
        kongNodeUrl: body.kongNodeUrl || '',
        kongVersion: body.kongVersion || '',
        data
      }
    })
    return {
      data: {
        id: created.id,
        name: created.name,
        kongNodeName: created.kongNodeName,
        kongNodeUrl: created.kongNodeUrl,
        kongVersion: created.kongVersion,
        createdAt: created.createdAt
      }
    }
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'Snapshot name already exists' })
    }
    throw err
  }
})
