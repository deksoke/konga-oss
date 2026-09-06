export const LINE_BROADCAST_URL = 'https://api.line.me/v2/bot/message/broadcast'
export const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push'
export const LINE_MULTICAST_URL = 'https://api.line.me/v2/bot/message/multicast'
export const LINE_FOLLOWERS_IDS_URL = 'https://api.line.me/v2/bot/followers/ids'

export const LINE_TEXT_MAX = 5000
export const LINE_MULTICAST_CHUNK = 500
export const LINE_ROOMS_CAP = 20
export const LINE_FOLLOWERS_CAP = 200

export type LineSendMode = 'followers' | 'rooms' | 'users'

export type LineKnownRoom = { id: string; name: string; kind: 'group' | 'room' }
export type LineKnownUser = { id: string; name: string }

export type LineSendPlan =
  | { kind: 'broadcast' }
  | { kind: 'push'; ids: string[] }
  | { kind: 'multicast'; ids: string[] }
  | { kind: 'skip'; reason: 'empty_rooms' | 'empty_users' | 'invalid_mode' }

export type LineTextMessage = { type: 'text'; text: string }

function looksLikeUrl(value: string) {
  const trimmed = value.trim()
  return /:\/\//.test(trimmed) || /^https?:/i.test(trimmed)
}

export function isValidLineChannelAccessToken(token: string) {
  const trimmed = token.trim()
  return Boolean(trimmed) && !looksLikeUrl(trimmed)
}

export function isValidLineDestinationId(id: string) {
  const trimmed = id.trim()
  if (!trimmed || looksLikeUrl(trimmed)) return false
  if (/^[A-Za-z]/.test(trimmed) && !/^[UCR]/i.test(trimmed)) return false
  return true
}

export function uniqueValidLineIds(ids: string[], cap?: number) {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of ids) {
    const id = String(raw || '').trim()
    if (!id || seen.has(id) || !isValidLineDestinationId(id)) continue
    seen.add(id)
    out.push(id)
    if (cap && out.length >= cap) break
  }
  return out
}

export function truncateLineText(text: string) {
  if (text.length <= LINE_TEXT_MAX) return text
  return text.slice(0, LINE_TEXT_MAX)
}

function textMessage(text: string): LineTextMessage {
  return { type: 'text', text: truncateLineText(text) }
}

export function buildBroadcastBody(text: string) {
  return { messages: [textMessage(text)] }
}

export function buildPushBody(to: string, text: string) {
  return { to, messages: [textMessage(text)] }
}

export function buildMulticastBody(userIds: string[], text: string) {
  return { to: userIds, messages: [textMessage(text)] }
}

export function chunkIds(ids: string[], size = LINE_MULTICAST_CHUNK) {
  const chunkSize = size > 0 ? size : LINE_MULTICAST_CHUNK
  const out: string[][] = []
  for (let i = 0; i < ids.length; i += chunkSize) {
    out.push(ids.slice(i, i + chunkSize))
  }
  return out
}

export function resolveLineSendPlan(
  mode: string,
  selectedRoomIds: string[],
  selectedUserIds: string[]
): LineSendPlan {
  if (mode === 'followers') return { kind: 'broadcast' }
  if (mode === 'rooms') {
    const ids = uniqueValidLineIds(selectedRoomIds, LINE_ROOMS_CAP)
    if (!ids.length) return { kind: 'skip', reason: 'empty_rooms' }
    return { kind: 'push', ids }
  }
  if (mode === 'users') {
    const ids = uniqueValidLineIds(selectedUserIds)
    if (!ids.length) return { kind: 'skip', reason: 'empty_users' }
    return { kind: 'multicast', ids }
  }
  return { kind: 'skip', reason: 'invalid_mode' }
}

export function lineProfileUrl(userId: string) {
  return `https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`
}

export function lineGroupSummaryUrl(groupId: string) {
  return `https://api.line.me/v2/bot/group/${encodeURIComponent(groupId)}/summary`
}

export function lineRoomMemberCountUrl(roomId: string) {
  return `https://api.line.me/v2/bot/room/${encodeURIComponent(roomId)}/members/count`
}

export function lineFieldValue(
  config: { fields?: Array<{ id: string; value?: string }>; [key: string]: unknown } | undefined,
  fieldId: string
) {
  if (!config) return ''
  const fromField = config.fields?.find((f) => f.id === fieldId)?.value
  return String(config[fieldId] ?? fromField ?? '').trim()
}

export function parseLineSendMode(raw: unknown): LineSendMode {
  return raw === 'followers' || raw === 'users' || raw === 'rooms' ? raw : 'rooms'
}

export function lineWebhookCallbackUrl(baseUrl: string) {
  const base = baseUrl.trim().replace(/\/+$/, '')
  if (!base) return ''
  return `${base}/api/integrations/line/webhook`
}
