import { createHmac } from 'node:crypto'
import { verifyLineSignature } from '../utils/lineWebhookSignature'

function sign(body: string, secret: string) {
  return createHmac('sha256', secret).update(body).digest('base64')
}

describe('verifyLineSignature', () => {
  const body = '{"events":[]}'
  const secret = 'channel-secret'

  it('accepts a valid HMAC-SHA256 signature', () => {
    expect(verifyLineSignature(body, secret, sign(body, secret))).toBe(true)
    expect(verifyLineSignature(Buffer.from(body, 'utf8'), secret, sign(body, secret))).toBe(true)
  })

  it('rejects an invalid signature', () => {
    expect(verifyLineSignature(body, secret, sign(body, 'other-secret'))).toBe(false)
    expect(verifyLineSignature(body, secret, 'not-a-valid-sig')).toBe(false)
    expect(verifyLineSignature('{"tampered":true}', secret, sign(body, secret))).toBe(false)
  })

  it('rejects missing secret or header', () => {
    expect(verifyLineSignature(body, '', sign(body, secret))).toBe(false)
    expect(verifyLineSignature(body, secret, undefined)).toBe(false)
    expect(verifyLineSignature(body, secret, '')).toBe(false)
  })
})
