import { clientIp, rateLimit } from '../../../../utils/rateLimit'
import { getUserSession } from '../../../../utils/session'
import {
  authorizeUrl,
  createPkce,
  decryptClientSecret,
  isOAuthProvider,
  loadOAuthProvider,
  oauthCallbackUrl,
  setOAuthState
} from '../../../../utils/oauth'

export default defineEventHandler(async (event) => {
  const provider = getRouterParam(event, 'provider')
  if (!isOAuthProvider(provider)) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown provider' })
  }

  const limited = rateLimit(`oauth-start:${clientIp(event)}`, 20, 15 * 60_000)
  if (!limited.ok) {
    throw createError({ statusCode: 429, statusMessage: 'Too many sign-in attempts. Try again later.' })
  }

  const intent = getQuery(event).intent === 'link' ? 'link' : 'login'
  const session = await getUserSession(event)
  if (intent === 'link' && !session) {
    return sendRedirect(event, '/login?oauth_error=login_required', 302)
  }

  const config = await loadOAuthProvider(provider)
  if (!config) {
    const fallback = intent === 'link' ? '/profile' : '/login'
    return sendRedirect(event, `${fallback}?oauth_error=not_configured`, 302)
  }

  const { verifier, challenge } = createPkce()
  const redirectUri = oauthCallbackUrl(event, provider)
  const nonce = await setOAuthState(event, {
    provider,
    intent,
    redirectUri,
    verifier,
    userId: intent === 'link' ? session?.id : undefined
  })

  const url = authorizeUrl(
    provider,
    config.clientId,
    redirectUri,
    nonce,
    challenge,
    config.issuerBaseUrl
  )
  return sendRedirect(event, url, 302)
})
