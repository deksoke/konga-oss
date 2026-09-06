import { lineApiFetch } from '../server/utils/lineApi'
import { sendLineNotification } from '../server/utils/notify'
import {
  LINE_API_ERROR_MAX,
  LINE_BROADCAST_URL,
  LINE_TEXT_MAX,
  buildBroadcastBody,
  buildMulticastBody,
  buildPushBody,
  chunkIds,
  formatLineApiError,
  integrationTestErrorMessage,
  isValidLineChannelAccessToken,
  isValidLineDestinationId,
  lineTestErrorMessage,
  resolveLineSendPlan,
  truncateLineText
} from '../utils/lineMessaging'

vi.mock('../server/utils/prisma', () => ({ prisma: {} }))
vi.mock('../server/utils/lineApi', () => ({
  lineApiFetch: vi.fn()
}))

describe('truncateLineText', () => {
  it('leaves short text unchanged', () => {
    expect(truncateLineText('hello')).toBe('hello')
  })

  it('trims to 5000 characters', () => {
    const text = 'a'.repeat(LINE_TEXT_MAX + 25)
    const out = truncateLineText(text)
    expect(out).toHaveLength(5000)
    expect(out).toBe(text.slice(0, 5000))
  })
})

describe('LINE message bodies', () => {
  it('builds a broadcast text payload', () => {
    expect(buildBroadcastBody('hello')).toEqual({
      messages: [{ type: 'text', text: 'hello' }]
    })
  })

  it('builds a push text payload', () => {
    expect(buildPushBody('Cgroup1', 'hi')).toEqual({
      to: 'Cgroup1',
      messages: [{ type: 'text', text: 'hi' }]
    })
  })

  it('builds a multicast text payload', () => {
    expect(buildMulticastBody(['U1', 'U2'], 'ping')).toEqual({
      to: ['U1', 'U2'],
      messages: [{ type: 'text', text: 'ping' }]
    })
  })

  it('trims text in payloads to 5000', () => {
    const long = 'x'.repeat(5001)
    expect(buildBroadcastBody(long).messages[0].text).toHaveLength(5000)
    expect(buildPushBody('U1', long).messages[0].text).toHaveLength(5000)
    expect(buildMulticastBody(['U1'], long).messages[0].text).toHaveLength(5000)
  })
})

describe('chunkIds', () => {
  it('chunks ids into groups of 500', () => {
    const ids = Array.from({ length: 1200 }, (_, i) => `U${i}`)
    const chunks = chunkIds(ids, 500)
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toHaveLength(500)
    expect(chunks[1]).toHaveLength(500)
    expect(chunks[2]).toHaveLength(200)
  })
})

describe('validation', () => {
  it('rejects URL-like tokens', () => {
    expect(isValidLineChannelAccessToken('')).toBe(false)
    expect(isValidLineChannelAccessToken('https://evil.example/token')).toBe(false)
    expect(isValidLineChannelAccessToken('http://127.0.0.1/x')).toBe(false)
    expect(isValidLineChannelAccessToken('https://api.line.me/v2/bot/message/broadcast')).toBe(false)
    expect(isValidLineChannelAccessToken('real-channel-token')).toBe(true)
  })

  it('accepts a fake token that contains + and /', () => {
    expect(isValidLineChannelAccessToken('eyJhbGciOiJIUzI1NiJ9.abc+def/ghi=.sig')).toBe(true)
  })

  it('rejects URL-like destination ids', () => {
    expect(isValidLineDestinationId('')).toBe(false)
    expect(isValidLineDestinationId('https://api.line.me/v2/bot')).toBe(false)
    expect(isValidLineDestinationId('U4af4980629')).toBe(true)
    expect(isValidLineDestinationId('Cgroupid')).toBe(true)
    expect(isValidLineDestinationId('Rroomid')).toBe(true)
  })
})

describe('resolveLineSendPlan', () => {
  it('followers broadcasts and ignores selected ids', () => {
    expect(resolveLineSendPlan('followers', ['C1'], ['U1'])).toEqual({ kind: 'broadcast' })
    expect(resolveLineSendPlan('followers', [], [])).toEqual({ kind: 'broadcast' })
  })

  it('skips rooms and users when selection is empty', () => {
    expect(resolveLineSendPlan('rooms', [], ['U1'])).toEqual({ kind: 'skip', reason: 'empty_rooms' })
    expect(resolveLineSendPlan('users', ['C1'], [])).toEqual({ kind: 'skip', reason: 'empty_users' })
  })

  it('unique-caps rooms at 20 and plans push', () => {
    const ids = Array.from({ length: 25 }, (_, i) => `C${i}`)
    const plan = resolveLineSendPlan('rooms', [...ids, 'C0'], [])
    expect(plan.kind).toBe('push')
    if (plan.kind === 'push') {
      expect(plan.ids).toHaveLength(20)
      expect(plan.ids[0]).toBe('C0')
      expect(new Set(plan.ids).size).toBe(20)
    }
  })

  it('plans multicast for selected users', () => {
    expect(resolveLineSendPlan('users', [], ['U1', 'U1', 'U2'])).toEqual({
      kind: 'multicast',
      ids: ['U1', 'U2']
    })
  })
})

describe('formatLineApiError', () => {
  it('includes HTTP status and LINE message from JSON', () => {
    const out = formatLineApiError(401, '{"message":"The access token is invalid"}')
    expect(out).toContain('401')
    expect(out).toContain('The access token is invalid')
    expect(out).not.toMatch(/Bearer/i)
  })

  it('falls back to HTTP status when the body is empty', () => {
    expect(formatLineApiError(500, '')).toBe('LINE Messaging API failed (HTTP 500)')
  })

  it('includes a non-JSON body', () => {
    const out = formatLineApiError(403, 'quota exceeded')
    expect(out).toContain('403')
    expect(out).toContain('quota exceeded')
  })

  it('caps length and does not dump extra JSON fields', () => {
    const long = formatLineApiError(400, `{"message":"${'x'.repeat(2000)}","access_token":"should-not-appear"}`)
    expect(long.length).toBeLessThanOrEqual(LINE_API_ERROR_MAX)
    expect(long).toContain('400')
    expect(long).not.toContain('should-not-appear')
    expect(long).not.toContain('access_token')
  })
})

describe('lineTestErrorMessage', () => {
  it('uses formatLineApiError detail for http_error', () => {
    const detail = formatLineApiError(401, '{"message":"The access token is invalid"}')
    expect(lineTestErrorMessage({ reason: 'http_error', status: 401, detail })).toBe(detail)
  })
})

describe('integrationTestErrorMessage', () => {
  it('shows data.message when statusMessage is missing', () => {
    expect(
      integrationTestErrorMessage(
        { data: { message: 'The access token is invalid' } },
        'LINE Official test failed'
      )
    ).toBe('The access token is invalid')
  })
})

describe('sendLineNotification', () => {
  const settings = {
    integrations: [
      {
        id: 'line',
        name: 'LINE Official',
        config: {
          enabled: true,
          fields: [
            {
              id: 'line_channel_access_token',
              name: 'Channel Access Token',
              type: 'password',
              value: 'fake-token-not-a-url'
            }
          ],
          line_send_mode: 'followers'
        }
      }
    ]
  }

  beforeEach(() => {
    vi.mocked(lineApiFetch).mockReset()
  })

  it('returns http_error detail from a mocked 401 LINE body', async () => {
    vi.mocked(lineApiFetch).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"message":"The access token is invalid"}'
    } as Response)

    const result = await sendLineNotification(settings as never, 'hello')
    expect(lineApiFetch).toHaveBeenCalledWith(
      LINE_BROADCAST_URL,
      'fake-token-not-a-url',
      expect.objectContaining({ method: 'POST' })
    )
    expect(result).toMatchObject({
      ok: false,
      reason: 'http_error',
      status: 401
    })
    if (!result.ok) {
      expect(result.detail).toContain('401')
      expect(result.detail).toContain('The access token is invalid')
    }
  })

  it('returns http_error detail when fetch throws', async () => {
    vi.mocked(lineApiFetch).mockRejectedValue(new Error('fetch failed'))
    const result = await sendLineNotification(settings as never, 'hello')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('http_error')
      expect(result.detail).toContain('fetch failed')
    }
  })
})
