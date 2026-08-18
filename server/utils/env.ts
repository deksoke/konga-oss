export function requireServerEnv() {
  const config = useRuntimeConfig()
  const databaseUrl =
    process.env.DATABASE_URL || (config.databaseUrl as string) || ''
  const sessionPassword =
    process.env.NUXT_SESSION_PASSWORD ||
    process.env.SESSION_PASSWORD ||
    String(config.sessionPassword || '')
  const credentialsKey =
    process.env.NODE_CREDENTIALS_KEY ||
    process.env.NUXT_CREDENTIALS_KEY ||
    String(config.credentialsKey || '')

  const missing: string[] = []
  if (!databaseUrl) missing.push('DATABASE_URL')
  if (!sessionPassword || sessionPassword.length < 32) {
    missing.push('NUXT_SESSION_PASSWORD (>= 32 chars)')
  }
  if (!credentialsKey || credentialsKey.length < 32) {
    missing.push('NODE_CREDENTIALS_KEY (>= 32 chars)')
  }

  if (missing.length) {
    throw createError({
      statusCode: 500,
      statusMessage: `Missing or invalid server env: ${missing.join(', ')}`
    })
  }

  return { databaseUrl, sessionPassword, credentialsKey }
}
