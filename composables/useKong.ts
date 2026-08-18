export function useKong() {
  function kongFetch<T = unknown>(path: string, opts: Parameters<typeof $fetch>[1] = {}) {
    const clean = path.replace(/^\/+/, '')
    // Empty path must hit /api/kong (index), not /api/kong/ which can fall through to the HTML app
    const url = clean ? `/api/kong/${clean}` : '/api/kong'
    return $fetch<T>(url, {
      credentials: 'include',
      ...opts
    })
  }

  return { kongFetch }
}
