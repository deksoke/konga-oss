import type { UpstreamFormModel } from '~/components/upstreams/UpstreamDetailsForm.vue'

function asNumberArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => {
    const n = Number(v)
    return Number.isNaN(n) ? v : n
  })
}

function numOrNull(value: unknown, fallback: number | null = null): number | null {
  if (value === null || value === undefined || value === '') return fallback
  const n = Number(value)
  return Number.isNaN(n) ? fallback : n
}

export function emptyUpstreamForm(): UpstreamFormModel {
  return {
    name: '',
    tags: [],
    algorithm: '',
    hash_on: 'none',
    hash_fallback: 'none',
    hash_on_header: '',
    hash_fallback_header: '',
    hash_on_cookie: '',
    hash_on_cookie_path: '/',
    slots: 10000,
    healthchecks: {
      active: {
        type: 'http',
        timeout: 1,
        concurrency: 10,
        http_path: '/',
        https_sni: '',
        https_verify_certificate: true,
        healthy: {
          interval: 0,
          http_statuses: [200, 302],
          successes: 0
        },
        unhealthy: {
          interval: 0,
          http_statuses: [429, 404, 500, 501, 502, 503, 504, 505],
          tcp_failures: 0,
          timeouts: 0,
          http_failures: 0
        }
      },
      passive: {
        type: 'http',
        healthy: {
          http_statuses: [
            200, 201, 202, 203, 204, 205, 206, 207, 208, 226, 300, 301, 302, 303, 304, 305, 306, 307,
            308
          ],
          successes: 0
        },
        unhealthy: {
          http_statuses: [429, 500, 503],
          tcp_failures: 0,
          timeouts: 0,
          http_failures: 0
        }
      }
    }
  }
}

export function fillUpstreamForm(u: any): UpstreamFormModel {
  const base = emptyUpstreamForm()
  const hc = u?.healthchecks || {}
  const active = hc.active || {}
  const passive = hc.passive || {}

  return {
    name: u?.name || '',
    tags: [...(u?.tags || [])],
    algorithm: u?.algorithm || '',
    hash_on: u?.hash_on || 'none',
    hash_fallback: u?.hash_fallback || 'none',
    hash_on_header: u?.hash_on_header || '',
    hash_fallback_header: u?.hash_fallback_header || '',
    hash_on_cookie: u?.hash_on_cookie || '',
    hash_on_cookie_path: u?.hash_on_cookie_path || '/',
    slots: numOrNull(u?.slots, 10000),
    healthchecks: {
      active: {
        type: active.type || 'http',
        timeout: numOrNull(active.timeout, 1),
        concurrency: numOrNull(active.concurrency, 10),
        http_path: active.http_path || '/',
        https_sni: active.https_sni || '',
        https_verify_certificate:
          active.https_verify_certificate === undefined
            ? true
            : Boolean(active.https_verify_certificate),
        healthy: {
          interval: numOrNull(active.healthy?.interval, 0),
          http_statuses: asNumberArray(active.healthy?.http_statuses).length
            ? asNumberArray(active.healthy?.http_statuses)
            : base.healthchecks.active.healthy.http_statuses,
          successes: numOrNull(active.healthy?.successes, 0)
        },
        unhealthy: {
          interval: numOrNull(active.unhealthy?.interval, 0),
          http_statuses: asNumberArray(active.unhealthy?.http_statuses).length
            ? asNumberArray(active.unhealthy?.http_statuses)
            : base.healthchecks.active.unhealthy.http_statuses,
          tcp_failures: numOrNull(active.unhealthy?.tcp_failures, 0),
          timeouts: numOrNull(active.unhealthy?.timeouts, 0),
          http_failures: numOrNull(active.unhealthy?.http_failures, 0)
        }
      },
      passive: {
        type: passive.type || 'http',
        healthy: {
          http_statuses: asNumberArray(passive.healthy?.http_statuses).length
            ? asNumberArray(passive.healthy?.http_statuses)
            : base.healthchecks.passive.healthy.http_statuses,
          successes: numOrNull(passive.healthy?.successes, 0)
        },
        unhealthy: {
          http_statuses: asNumberArray(passive.unhealthy?.http_statuses).length
            ? asNumberArray(passive.unhealthy?.http_statuses)
            : base.healthchecks.passive.unhealthy.http_statuses,
          tcp_failures: numOrNull(passive.unhealthy?.tcp_failures, 0),
          timeouts: numOrNull(passive.unhealthy?.timeouts, 0),
          http_failures: numOrNull(passive.unhealthy?.http_failures, 0)
        }
      }
    }
  }
}

function toIntList(values: unknown[]): number[] {
  return values
    .map((v) => Number(v))
    .filter((n) => !Number.isNaN(n))
}

export function buildUpstreamPayload(form: UpstreamFormModel) {
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    hash_on: form.hash_on || 'none',
    hash_fallback: form.hash_fallback || 'none',
    healthchecks: {
      active: {
        type: form.healthchecks.active.type || 'http',
        timeout: Number(form.healthchecks.active.timeout ?? 1),
        concurrency: Number(form.healthchecks.active.concurrency ?? 10),
        http_path: form.healthchecks.active.http_path || '/',
        https_verify_certificate: Boolean(form.healthchecks.active.https_verify_certificate),
        healthy: {
          interval: Number(form.healthchecks.active.healthy.interval ?? 0),
          http_statuses: toIntList(form.healthchecks.active.healthy.http_statuses),
          successes: Number(form.healthchecks.active.healthy.successes ?? 0)
        },
        unhealthy: {
          interval: Number(form.healthchecks.active.unhealthy.interval ?? 0),
          http_statuses: toIntList(form.healthchecks.active.unhealthy.http_statuses),
          tcp_failures: Number(form.healthchecks.active.unhealthy.tcp_failures ?? 0),
          timeouts: Number(form.healthchecks.active.unhealthy.timeouts ?? 0),
          http_failures: Number(form.healthchecks.active.unhealthy.http_failures ?? 0)
        }
      },
      passive: {
        type: form.healthchecks.passive.type || 'http',
        healthy: {
          http_statuses: toIntList(form.healthchecks.passive.healthy.http_statuses),
          successes: Number(form.healthchecks.passive.healthy.successes ?? 0)
        },
        unhealthy: {
          http_statuses: toIntList(form.healthchecks.passive.unhealthy.http_statuses),
          tcp_failures: Number(form.healthchecks.passive.unhealthy.tcp_failures ?? 0),
          timeouts: Number(form.healthchecks.passive.unhealthy.timeouts ?? 0),
          http_failures: Number(form.healthchecks.passive.unhealthy.http_failures ?? 0)
        }
      }
    }
  }

  if (form.tags.length) payload.tags = form.tags.map(String)
  else payload.tags = []

  if (form.algorithm.trim()) payload.algorithm = form.algorithm.trim()
  if (form.slots != null) payload.slots = Number(form.slots)

  if (form.hash_on === 'header' && form.hash_on_header.trim()) {
    payload.hash_on_header = form.hash_on_header.trim()
  }
  if (form.hash_fallback === 'header' && form.hash_fallback_header.trim()) {
    payload.hash_fallback_header = form.hash_fallback_header.trim()
  }
  if (
    (form.hash_on === 'cookie' || form.hash_fallback === 'cookie') &&
    form.hash_on_cookie.trim()
  ) {
    payload.hash_on_cookie = form.hash_on_cookie.trim()
    payload.hash_on_cookie_path = form.hash_on_cookie_path.trim() || '/'
  }

  const sni = form.healthchecks.active.https_sni.trim()
  if (sni) {
    ;(payload.healthchecks as any).active.https_sni = sni
  } else {
    ;(payload.healthchecks as any).active.https_sni = null
  }

  return payload
}
