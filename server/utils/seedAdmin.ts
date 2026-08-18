import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

function generatePassword(bytes = 18) {
  // URL-safe-ish: strip chars that are easy to mis-copy in logs
  return randomBytes(bytes)
    .toString('base64url')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 24)
}

/**
 * Create the first admin user when the database has no users yet.
 * Password is random unless KONGA_ADMIN_PASSWORD is set — printed once to stdout for container logs.
 */
export async function ensureInitialAdmin() {
  const existing = await prisma.user.count()
  if (existing > 0) return { created: false as const }

  const username = (process.env.KONGA_ADMIN_USERNAME || 'admin').trim() || 'admin'
  const email = (process.env.KONGA_ADMIN_EMAIL || 'admin@konga.local').trim().toLowerCase()
  const fromEnv = process.env.KONGA_ADMIN_PASSWORD?.trim()
  const password = fromEnv && fromEnv.length >= 8 ? fromEnv : generatePassword()
  const passwordFromEnv = Boolean(fromEnv && fromEnv.length >= 8)

  const passwordHash = await bcrypt.hash(password, 12)

  try {
    await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: 'admin',
        active: true,
        theme: 'auto'
      }
    })
  } catch (err: any) {
    // Concurrent boot (another replica seeded first)
    if (err?.code === 'P2002') {
      console.info('[konga] Initial admin already exists (created by another process)')
      return { created: false as const }
    }
    throw err
  }

  console.info('')
  console.info('============================================================')
  console.info('[konga] Initial administrator account created')
  console.info(`[konga] username: ${username}`)
  console.info(`[konga] email:    ${email}`)
  console.info(`[konga] password: ${password}`)
  if (passwordFromEnv) {
    console.info('[konga] (password taken from KONGA_ADMIN_PASSWORD)')
  } else {
    console.info('[konga] Change this password after first login.')
    console.info('[konga] This password is shown only once — check container logs now.')
  }
  console.info('============================================================')
  console.info('')

  return { created: true as const, username, email }
}
