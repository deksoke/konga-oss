import { prisma } from '../utils/prisma'
import {
  decryptCredentialsDetailed,
  encryptCredentials
} from '../utils/crypto'

/**
 * Re-encrypt Kong node credentials after NODE_CREDENTIALS_KEY rotation.
 */
export default defineNitroPlugin(async () => {
  try {
    const nodes = await prisma.kongNode.findMany({
      select: { id: true, credentialsEnc: true }
    })
    let migrated = 0
    for (const node of nodes) {
      if (!node.credentialsEnc) continue
      try {
        const result = decryptCredentialsDetailed(node.credentialsEnc)
        if (!result.needsReencrypt) continue
        await prisma.kongNode.update({
          where: { id: node.id },
          data: { credentialsEnc: encryptCredentials(result.credentials) }
        })
        migrated++
      } catch {
        console.warn(
          `[konga] Node ${node.id}: credentials encrypted with unknown key — re-save the connection`
        )
      }
    }
    if (migrated > 0) {
      console.info(`[konga] Re-encrypted credentials for ${migrated} Kong connection(s)`)
    }
  } catch (err) {
    console.warn('[konga] Credential migration skipped:', err)
  }
})
