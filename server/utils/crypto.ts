import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'
import { requireServerEnv } from './env'

export type KongCredentials = {
  apiKey?: string
  username?: string
  password?: string
  jwtKey?: string
  jwtSecret?: string
  jwtAlgorithm?: 'HS256' | 'RS256'
}

export class CredentialsDecryptError extends Error {
  constructor(message = 'Stored Kong credentials could not be decrypted') {
    super(message)
    this.name = 'CredentialsDecryptError'
  }
}

function deriveKey(secret: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, 'hex')
  }
  return createHash('sha256').update(secret).digest()
}

function primaryKey(): Buffer {
  const { credentialsKey } = requireServerEnv()
  return deriveKey(credentialsKey)
}

/**
 * Keys to try when the primary key fails (e.g. after rotating NODE_CREDENTIALS_KEY).
 * Order: explicit legacy env, then former docker-compose / .env.example defaults.
 */
function legacyKeys(): Buffer[] {
  const keys: Buffer[] = []
  const seen = new Set<string>()
  const primary = requireServerEnv().credentialsKey
  seen.add(primary)

  const candidates = [
    process.env.NODE_CREDENTIALS_KEY_LEGACY || '',
    // Previous local/docker defaults used before secret rotation
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  ]

  for (const c of candidates) {
    if (!c || c.length < 32 || seen.has(c)) continue
    seen.add(c)
    keys.push(deriveKey(c))
  }
  return keys
}

function decryptUtf8WithKey(blob: string, key: Buffer): string {
  const buf = Buffer.from(blob, 'base64')
  if (buf.length < 28) {
    throw new CredentialsDecryptError('Invalid credentials blob')
  }
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString('utf8')
}

function decryptWithKey(blob: string, key: Buffer): KongCredentials {
  return JSON.parse(decryptUtf8WithKey(blob, key)) as KongCredentials
}

export function encryptUtf8(plaintext: string): string {
  if (!plaintext) return ''
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', primaryKey(), iv)
  const encrypted = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptUtf8(blob: string): string {
  if (!blob) return ''
  try {
    return decryptUtf8WithKey(blob, primaryKey())
  } catch {
    // fall through
  }
  for (const key of legacyKeys()) {
    try {
      return decryptUtf8WithKey(blob, key)
    } catch {
      // try next
    }
  }
  throw new CredentialsDecryptError(
    'Stored secret is encrypted with a different NODE_CREDENTIALS_KEY. Re-save the value, or set NODE_CREDENTIALS_KEY_LEGACY to the previous key.'
  )
}

export function encryptCredentials(payload: KongCredentials): string {
  if (!payload || Object.keys(payload).length === 0) {
    return ''
  }
  return encryptUtf8(JSON.stringify(payload))
}

export type DecryptResult = {
  credentials: KongCredentials
  /** True when a legacy key was used — caller should re-encrypt and persist. */
  needsReencrypt: boolean
}

export function decryptCredentialsDetailed(blob: string): DecryptResult {
  if (!blob) {
    return { credentials: {}, needsReencrypt: false }
  }

  try {
    return { credentials: decryptWithKey(blob, primaryKey()), needsReencrypt: false }
  } catch {
    // fall through to legacy keys
  }

  for (const key of legacyKeys()) {
    try {
      return { credentials: decryptWithKey(blob, key), needsReencrypt: true }
    } catch {
      // try next
    }
  }

  throw new CredentialsDecryptError(
    'Kong connection credentials are encrypted with a different NODE_CREDENTIALS_KEY. Re-save the connection credentials, or set NODE_CREDENTIALS_KEY_LEGACY to the previous key.'
  )
}

export function decryptCredentials(blob: string): KongCredentials {
  return decryptCredentialsDetailed(blob).credentials
}
