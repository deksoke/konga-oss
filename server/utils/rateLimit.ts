/** Simple in-memory rate limiter (per process). Good enough for single-instance deploys. */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 }
  }
  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(0, existing.resetAt - now)
    }
  }
  existing.count += 1
  return { ok: true, remaining: limit - existing.count, retryAfterMs: 0 }
}

export function clientIp(event: { node?: { req?: { headers?: Record<string, unknown>; socket?: { remoteAddress?: string } } } }) {
  const headers = event.node?.req?.headers || {}
  const xf = headers['x-forwarded-for']
  if (typeof xf === 'string' && xf.length) {
    return xf.split(',')[0].trim()
  }
  return event.node?.req?.socket?.remoteAddress || 'unknown'
}

// Periodic cleanup to avoid unbounded growth
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k)
  }
}, 60_000).unref?.()
