import { prisma } from '../../../../utils/prisma'
import { clientIp, rateLimit } from '../../../../utils/rateLimit'
import { setUserSession, toSessionUser } from '../../../../utils/session'
import {
  decryptClientSecret,
  exchangeCode,
  isOAuthProvider,
  loadOAuthProvider,
  oauthCallbackUrl,
  oauthErrorRedirect,
  readOAuthState
} from '../../../../utils/oauth'

export default defineEventHandler(async (event) => {
  const provider = getRouterParam(event, 'provider')
  if (!isOAuthProvider(provider)) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown provider' })
  }

  const limited = rateLimit(`oauth-cb:${clientIp(event)}`, 30, 15 * 60_000)
  if (!limited.ok) {
    return sendRedirect(event, oauthErrorRedirect('/login', 'rate_limited'), 302)
  }

  const query = getQuery(event)
  if (typeof query.error === 'string' && query.error) {
    return sendRedirect(event, oauthErrorRedirect('/login', 'denied'), 302)
  }

  const code = typeof query.code === 'string' ? query.code : ''
  const returnedState = typeof query.state === 'string' ? query.state : ''
  const stored = await readOAuthState(event, returnedState)
  if (!code || !stored || stored.provider !== provider) {
    return sendRedirect(event, oauthErrorRedirect('/login', 'invalid_state'), 302)
  }

  const expectedRedirect = oauthCallbackUrl(event, provider)
  if (stored.redirectUri !== expectedRedirect) {
    return sendRedirect(event, oauthErrorRedirect('/login', 'invalid_state'), 302)
  }

  const config = await loadOAuthProvider(provider)
  if (!config) {
    return sendRedirect(event, oauthErrorRedirect('/login', 'not_configured'), 302)
  }

  let providerUserId = ''
  try {
    providerUserId = await exchangeCode({
      provider,
      clientId: config.clientId,
      clientSecret: decryptClientSecret(config),
      redirectUri: stored.redirectUri,
      code,
      verifier: stored.verifier,
      issuerBaseUrl: config.issuerBaseUrl
    })
  } catch {
    return sendRedirect(event, oauthErrorRedirect('/login', 'exchange_failed'), 302)
  }

  const fallback = stored.intent === 'link' ? '/profile' : '/login'

  if (stored.intent === 'link') {
    if (!stored.userId) {
      return sendRedirect(event, oauthErrorRedirect('/login', 'login_required'), 302)
    }
    const existing = await prisma.userOAuthAccount.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } }
    })
    if (existing && existing.userId !== stored.userId) {
      return sendRedirect(event, oauthErrorRedirect('/profile', 'already_linked'), 302)
    }
    if (!existing) {
      try {
        await prisma.userOAuthAccount.create({
          data: { userId: stored.userId, provider, providerUserId }
        })
      } catch {
        return sendRedirect(event, oauthErrorRedirect('/profile', 'already_linked'), 302)
      }
    }
    return sendRedirect(event, '/profile?oauth=linked', 302)
  }

  const account = await prisma.userOAuthAccount.findUnique({
    where: { provider_providerUserId: { provider, providerUserId } },
    include: { user: true }
  })
  if (!account) {
    return sendRedirect(event, oauthErrorRedirect(fallback, 'not_linked'), 302)
  }
  if (!account.user.active) {
    return sendRedirect(event, oauthErrorRedirect(fallback, 'inactive'), 302)
  }

  await setUserSession(event, toSessionUser(account.user))
  return sendRedirect(event, '/', 302)
})
