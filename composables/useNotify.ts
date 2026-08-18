export type NotifyKind = 'success' | 'error' | 'info'

export type NotifyItem = {
  id: number
  kind: NotifyKind
  message: string
  createdAt: number
}

let seq = 0

export function useNotify() {
  const toasts = useState<NotifyItem[]>('app-toasts', () => [])

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function push(kind: NotifyKind, message: string, ttlMs = 4200) {
    const id = ++seq
    const item: NotifyItem = { id, kind, message, createdAt: Date.now() }
    toasts.value = [...toasts.value, item]
    if (import.meta.client) {
      window.setTimeout(() => dismiss(id), ttlMs)
    }
    return id
  }

  return {
    toasts,
    dismiss,
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message, 6500),
    info: (message: string) => push('info', message)
  }
}
