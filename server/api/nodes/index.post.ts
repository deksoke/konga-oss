import { z } from 'zod'
import { requireAdmin } from '../../utils/session'
import { prisma } from '../../utils/prisma'
import { encryptCredentials } from '../../utils/crypto'
import { maskNode } from '../../utils/kong'
import { assertUniqueKongAdminUrl } from '../../utils/nodes'
import { assertSafeKongAdminUrl } from '../../utils/urlSafety'

const bodySchema = z.object({
  name: z.string().min(1).max(128),
  kongAdminUrl: z.string().url(),
  authType: z.enum(['default', 'key_auth', 'jwt', 'basic_auth']).default('default'),
  apiKey: z.string().max(512).optional(),
  username: z.string().max(256).optional(),
  password: z.string().max(256).optional(),
  jwtKey: z.string().max(512).optional(),
  jwtSecret: z.string().max(2048).optional(),
  jwtAlgorithm: z.enum(['HS256', 'RS256']).optional()
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = bodySchema.parse(await readBody(event))
  const kongAdminUrl = await assertSafeKongAdminUrl(body.kongAdminUrl)
  await assertUniqueKongAdminUrl(kongAdminUrl)
  const credentialsEnc = encryptCredentials({
    apiKey: body.apiKey,
    username: body.username,
    password: body.password,
    jwtKey: body.jwtKey,
    jwtSecret: body.jwtSecret,
    jwtAlgorithm: body.jwtAlgorithm
  })

  const node = await prisma.kongNode.create({
    data: {
      name: body.name,
      kongAdminUrl,
      authType: body.authType,
      credentialsEnc
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
