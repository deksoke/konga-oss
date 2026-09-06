import {
  LINE_TEXT_MAX,
  buildBroadcastBody,
  buildMulticastBody,
  buildPushBody,
  chunkIds,
  isValidLineChannelAccessToken,
  isValidLineDestinationId,
  resolveLineSendPlan,
  truncateLineText
} from '../utils/lineMessaging'

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
    expect(isValidLineChannelAccessToken('real-channel-token')).toBe(true)
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
