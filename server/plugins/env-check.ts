const INSECURE_SESSION = new Set([
  'change-me-to-a-long-random-string-at-least-32-chars',
  'local-dev-session-password-change-me-32',
  'konga-session-password-change-me-please-32chars'
])

const INSECURE_CREDENTIALS = new Set([
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  '0000000000000000000000000000000000000000000000000000000000000000'
])

export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV !== 'production') return

  const creds =
    process.env.NODE_CREDENTIALS_KEY || process.env.NUXT_CREDENTIALS_KEY || ''
  const session = process.env.NUXT_SESSION_PASSWORD || ''
  const missing: string[] = []
  const insecure: string[] = []

  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL')
  if (!session || session.length < 32) missing.push('NUXT_SESSION_PASSWORD')
  if (!creds || creds.length < 32) missing.push('NODE_CREDENTIALS_KEY')

  if (INSECURE_SESSION.has(session)) insecure.push('NUXT_SESSION_PASSWORD')
  if (INSECURE_CREDENTIALS.has(creds.toLowerCase())) insecure.push('NODE_CREDENTIALS_KEY')

  // Local docker compose may opt out while still using NODE_ENV=production for Nitro
  const allowInsecure = process.env.KONGA_ALLOW_INSECURE_SECRETS === 'true'

  if (missing.length) {
    console.error(`[konga] Refusing to start. Missing env: ${missing.join(', ')}`)
    process.exit(1)
  }

  if (insecure.length && !allowInsecure) {
    console.error(
      `[konga] Refusing to start. Insecure default secrets: ${insecure.join(', ')}. ` +
        'Generate unique values, or set KONGA_ALLOW_INSECURE_SECRETS=true for local-only use.'
    )
    process.exit(1)
  }

  if (insecure.length && allowInsecure) {
    console.warn(
      `[konga] WARNING: insecure default secrets in use (${insecure.join(', ')}). Never deploy like this.`
    )
  }
})
