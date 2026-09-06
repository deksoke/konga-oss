import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyLineSignature(
  rawBody: string | Buffer,
  channelSecret: string,
  headerValue: string | undefined
): boolean {
  if (!channelSecret || !headerValue) return false
  const body = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody
  const digest = createHmac('sha256', channelSecret).update(body).digest('base64')
  const expected = Buffer.from(digest)
  const received = Buffer.from(headerValue)
  if (expected.length !== received.length) return false
  return timingSafeEqual(expected, received)
}
