import {
  lineGroupSummaryUrl,
  lineRoomMemberCountUrl,
  type LineKnownRoom
} from '../../utils/lineMessaging'

/** LINE Messaging API fetch — URLs must be hardcoded https://api.line.me/... */
export async function lineApiFetch(url: string, token: string, init: RequestInit = {}) {
  if (!url.startsWith('https://api.line.me/')) {
    throw new Error('Refusing non-LINE URL')
  }
  const { headers: extraHeaders, ...rest } = init
  return fetch(url, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(extraHeaders || {})
    },
    redirect: 'error'
  })
}

/** Try group summary, then room member count. */
export async function resolveLineRoom(token: string, id: string): Promise<LineKnownRoom | null> {
  const groupRes = await lineApiFetch(lineGroupSummaryUrl(id), token)
  if (groupRes.ok) {
    const data = (await groupRes.json().catch(() => null)) as { groupName?: string } | null
    return { id, name: String(data?.groupName || id).trim() || id, kind: 'group' }
  }

  const roomRes = await lineApiFetch(lineRoomMemberCountUrl(id), token)
  if (roomRes.ok) {
    return { id, name: id, kind: 'room' }
  }
  return null
}

