import { createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { SignJWT, jwtVerify } from 'jose'
import { requireServerEnv } from './env'
import { decryptUtf8 } from './crypto'
import {
  DEFAULT_GITLAB_BASE_URL,
  mergeSettings,
  normalizeIssuerBaseUrl,
  oauthProviderReady,
  type OAuthProviderId,
  type OAuthProviderStored
} from './settings'
import { prisma } from './prisma'

const STATE_COOKIE = 'konga_oauth'
const FACEBOOK_VERSION = 'v21.0'

export const OAUTH_PROVIDERS: OAuthProviderId[] = [
  'google',
  'facebook',
  'line',
  'github',
  'gitlab'
]

export function isOAuthProvider(value: string | undefined): value is OAuthProviderId {
  return (
    value === 'google' ||
    value === 'facebook' ||
    value === 'line' ||
    value === 'github' ||
    value === 'gitlab'
  )
}

function secretKey() {
  const { sessionPassword } = requireServerEnv()
  return new TextEncoder().encode(sessionPassword)
}

function cookieSecure() {
  if (process.env.COOKIE_SECURE === 'true') return true
  if (process.env.COOKIE_SECURE === 'false') return false
  return process.env.NODE_ENV === 'production'
}

export function publicOrigin(event: H3Event) {
  return getRequestURL(event).origin
}

export function oauthCallbackUrl(event: H3Event, provider: OAuthProviderId) {
  return `${publicOrigin(event)}/api/auth/oauth/${provider}/callback`
}

type OAuthState = {
  provider: OAuthProviderId
  intent: 'login' | 'link'
  redirectUri: string
  verifier: string
  userId?: string
}

function base64url(buf: Buffer) {
  return buf.toString('base64url')
}

export function createPkce() {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export async function setOAuthState(event: H3Event, state: OAuthState) {
  const nonce = base64url(randomBytes(16))
  const token = await new SignJWT({ ...state, nonce })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .setJti(nonce)
    .sign(secretKey())

  setCookie(event, STATE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(),
    path: '/',
    maxAge: 10 * 60
  })
  return nonce
}

export async function readOAuthState(event: H3Event, expectedState: string): Promise<OAuthState | null> {
  const token = getCookie(event, STATE_COOKIE)
  deleteCookie(event, STATE_COOKIE, { path: '/' })
  if (!token || !expectedState) return null
  try {
    const { payload } = await jwtVerify(token, secretKey())
    if (payload.jti !== expectedState && payload.nonce !== expectedState) return null
    const provider = payload.provider
    const intent = payload.intent
    const redirectUri = payload.redirectUri
    const verifier = payload.verifier
    const id = String(provider || '')
    if (!isOAuthProvider(id)) return null
    if (intent !== 'login' && intent !== 'link') return null
    if (typeof redirectUri !== 'string' || typeof verifier !== 'string') return null
    return {
      provider: id,
      intent,
      redirectUri,
      verifier,
      userId: typeof payload.userId === 'string' ? payload.userId : undefined
    }
  } catch {
    return null
  }
}

export async function loadOAuthProvider(id: OAuthProviderId): Promise<OAuthProviderStored | null> {
  const row = await prisma.appSettings.findUnique({ where: { id: 'default' } })
  const settings = mergeSettings(row?.data)
  const provider = settings.oauth_providers[id]
  if (!oauthProviderReady(provider)) return null
  return provider
}

export function decryptClientSecret(provider: OAuthProviderStored) {
  return decryptUtf8(provider.clientSecretEnc)
}

export function authorizeUrl(
  provider: OAuthProviderId,
  clientId: string,
  redirectUri: string,
  state: string,
  challenge: string,
  issuerBaseUrl?: string
) {
  if (provider === 'google') {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'openid email')
    url.searchParams.set('state', state)
    url.searchParams.set('code_challenge', challenge)
    url.searchParams.set('code_challenge_method', 'S256')
    return url.toString()
  }
  if (provider === 'facebook') {
    const url = new URL(`https://www.facebook.com/${FACEBOOK_VERSION}/dialog/oauth`)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'public_profile')
    url.searchParams.set('state', state)
    return url.toString()
  }
  if (provider === 'github') {
    const url = new URL('https://github.com/login/oauth/authorize')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('scope', 'read:user')
    url.searchParams.set('state', state)
    url.searchParams.set('code_challenge', challenge)
    url.searchParams.set('code_challenge_method', 'S256')
    return url.toString()
  }
  if (provider === 'gitlab') {
    const base = normalizeIssuerBaseUrl(issuerBaseUrl, DEFAULT_GITLAB_BASE_URL)
    const url = new URL(`${base}/oauth/authorize`)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'read_user')
    url.searchParams.set('state', state)
    url.searchParams.set('code_challenge', challenge)
    url.searchParams.set('code_challenge_method', 'S256')
    return url.toString()
  }
  const url = new URL('https://access.line.me/oauth2/v2.1/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('scope', 'profile openid')
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

async function formPost(url: string, body: Record<string, string>) {
  return await $fetch<Record<string, any>>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString()
  })
}

export async function exchangeCode(opts: {
  provider: OAuthProviderId
  clientId: string
  clientSecret: string
  redirectUri: string
  code: string
  verifier: string
  issuerBaseUrl?: string
}): Promise<string> {
  const { provider, clientId, clientSecret, redirectUri, code, verifier, issuerBaseUrl } = opts

  if (provider === 'google') {
    const token = await formPost('https://oauth2.googleapis.com/token', {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier
    })
    const access = String(token.access_token || '')
    if (!access) throw new Error('Google token missing')
    const userinfo = await $fetch<{ sub?: string }>('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${access}` }
    })
    if (!userinfo.sub) throw new Error('Google user id missing')
    return userinfo.sub
  }

  if (provider === 'facebook') {
    const token = await $fetch<{ access_token?: string }>(
      `https://graph.facebook.com/${FACEBOOK_VERSION}/oauth/access_token`,
      {
        query: {
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri
        }
      }
    )
    const access = String(token.access_token || '')
    if (!access) throw new Error('Facebook token missing')
    const me = await $fetch<{ id?: string }>(`https://graph.facebook.com/${FACEBOOK_VERSION}/me`, {
      query: { fields: 'id', access_token: access }
    })
    if (!me.id) throw new Error('Facebook user id missing')
    return me.id
  }

  if (provider === 'github') {
    const token = await $fetch<{ access_token?: string }>('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier
      }
    })
    const access = String(token.access_token || '')
    if (!access) throw new Error('GitHub token missing')
    const user = await $fetch<{ id?: number | string }>('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${access}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'konga-oss'
      }
    })
    if (user.id == null) throw new Error('GitHub user id missing')
    return String(user.id)
  }

  if (provider === 'gitlab') {
    const base = normalizeIssuerBaseUrl(issuerBaseUrl, DEFAULT_GITLAB_BASE_URL)
    const token = await formPost(`${base}/oauth/token`, {
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: verifier
    })
    const access = String(token.access_token || '')
    if (!access) throw new Error('GitLab token missing')
    const user = await $fetch<{ id?: number | string }>(`${base}/api/v4/user`, {
      headers: { Authorization: `Bearer ${access}` }
    })
    if (user.id == null) throw new Error('GitLab user id missing')
    return String(user.id)
  }

  const token = await formPost('https://api.line.me/oauth2/v2.1/token', {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: verifier
  })
  const access = String(token.access_token || '')
  if (!access) throw new Error('LINE token missing')
  const profile = await $fetch<{ userId?: string }>('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${access}` }
  })
  if (!profile.userId) throw new Error('LINE user id missing')
  return profile.userId
}

export function oauthErrorRedirect(path: string, code: string) {
  const url = new URL(path, 'http://local')
  url.searchParams.set('oauth_error', code)
  return `${url.pathname}${url.search}`
}
