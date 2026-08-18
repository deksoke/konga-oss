import { z } from 'zod'
import { requireAdmin } from '../../utils/session'
import { prisma } from '../../utils/prisma'
import {
  CredentialsDecryptError,
  decryptCredentialsDetailed,
  encryptCredentials
} from '../../utils/crypto'
import { maskNode } from '../../utils/kong'
import { assertUniqueKongAdminUrl } from '../../utils/nodes'
import { assertSafeKongAdminUrl } from '../../utils/urlSafety'

const bodySchema = z.object({
  name: z.string().min(1).max(128).optional(),
  kongAdminUrl: z.string().url().optional(),
  authType: z.enum(['default', 'key_auth', 'jwt', 'basic_auth']).optional(),
  apiKey: z.string().max(512).optional(),
  username: z.string().max(256).optional(),
  password: z.string().max(256).optional(),
  jwtKey: z.string().max(512).optional(),
  jwtSecret: z.string().max(2048).optional(),
  jwtAlgorithm: z.enum(['HS256', 'RS256']).optional(),
  healthChecks: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const body = bodySchema.parse(await readBody(event))
  const existing = await prisma.kongNode.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Node not found' })
  }

  const kongAdminUrl = body.kongAdminUrl
    ? await assertSafeKongAdminUrl(body.kongAdminUrl)
    : undefined

  if (kongAdminUrl) {
    await assertUniqueKongAdminUrl(kongAdminUrl, id)
  }

  let current: Record<string, string | undefined> = {}
  try {
    current = decryptCredentialsDetailed(existing.credentialsEnc).credentials
  } catch (err) {
    if (!(err instanceof CredentialsDecryptError)) throw err
    // Allow overwriting broken credentials after key rotation
    current = {}
  }

  const nextCreds = {
    apiKey: body.apiKey !== undefined ? body.apiKey : current.apiKey,
    username: body.username !== undefined ? body.username : current.username,
    password: body.password !== undefined ? body.password : current.password,
    jwtKey: body.jwtKey !== undefined ? body.jwtKey : current.jwtKey,
    jwtSecret: body.jwtSecret !== undefined ? body.jwtSecret : current.jwtSecret,
    jwtAlgorithm: body.jwtAlgorithm !== undefined ? body.jwtAlgorithm : current.jwtAlgorithm
  }

  const node = await prisma.kongNode.update({
    where: { id },
    data: {
      name: body.name,
      kongAdminUrl,
      authType: body.authType,
      credentialsEnc: encryptCredentials(nextCreds),
      ...(body.healthChecks !== undefined
        ? {
            healthChecks: body.healthChecks,
            healthCheckDetails: body.healthChecks
              ? existing.healthCheckDetails || {
                  last_checked: null,
                  last_failed: null,
                  last_success: null,
                  first_failed: null
                }
              : existing.healthCheckDetails
          }
        : {})
    }
  })

  return {
    data: {
      ...maskNode(node),
      createdAt: node.createdAt,
      updatedAt: node.updatedAt
    }
  }
})
