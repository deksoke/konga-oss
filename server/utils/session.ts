import type { H3Event } from 'h3'
import { SignJWT, jwtVerify } from 'jose'
import { requireServerEnv } from './env'
import { prisma } from './prisma'

export type ThemePreference = 'day' | 'night' | 'auto'

export type SessionUser = {
  id: string
  username: string
  email: string
  role: 'admin' | 'user'
  activeNodeId: string | null
  theme: ThemePreference
}

const COOKIE = 'konga_session'
const MAX_AGE = 60 * 60 * 24 * 7

function secretKey() {
  const { sessionPassword } = requireServerEnv()
  return new TextEncoder().encode(sessionPassword)
}

function cookieSecure() {
  if (process.env.COOKIE_SECURE === 'true') return true
  if (process.env.COOKIE_SECURE === 'false') return false
  return process.env.NODE_ENV === 'production'
}

function cookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: cookieSecure(),
    path: '/',
    ...(maxAge !== undefined ? { maxAge } : {})
  }
}

export function normalizeTheme(value: unknown): ThemePreference {
  if (value === 'day' || value === 'night' || value === 'auto') return value
  return 'auto'
}

export function toSessionUser(user: {
  id: string
  username: string
  email: string
  role: string
  activeNodeId: string | null
  theme?: string | null
}): SessionUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role as 'admin' | 'user',
    activeNodeId: user.activeNodeId,
    theme: normalizeTheme(user.theme)
  }
}

export async function setUserSession(event: H3Event, user: SessionUser) {
  const token = await new SignJWT({ user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey())

  setCookie(event, COOKIE, token, cookieOptions(MAX_AGE))
}

export async function clearUserSession(event: H3Event) {
  deleteCookie(event, COOKIE, cookieOptions())
}

export async function getUserSession(event: H3Event): Promise<SessionUser | null> {
  const token = getCookie(event, COOKIE)
  if (!token) {
    return null
  }
  try {
    const { payload } = await jwtVerify(token, secretKey())
    const user = (payload as { user: SessionUser }).user
    if (!user?.id) return null
    return {
      ...user,
      theme: normalizeTheme(user.theme)
    }
  } catch {
    return null
  }
}

/**
 * Verify JWT then re-load user from DB so demotions / deactivations take effect immediately.
 */
export async function requireUser(event: H3Event): Promise<SessionUser> {
  const session = await getUserSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const dbUser = await prisma.user.findUnique({ where: { id: session.id } })
  if (!dbUser || !dbUser.active) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const fresh = toSessionUser(dbUser)
  // Refresh cookie if role / node / theme drifted from JWT
  if (
    fresh.role !== session.role ||
    fresh.activeNodeId !== session.activeNodeId ||
    fresh.theme !== session.theme ||
    fresh.username !== session.username ||
    fresh.email !== session.email
  ) {
    await setUserSession(event, fresh)
  }

  return fresh
}

export async function requireAdmin(event: H3Event): Promise<SessionUser> {
  const user = await requireUser(event)
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  }
  return user
}
