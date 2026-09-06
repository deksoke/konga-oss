export const DAY_START_HOUR = 6
export const DAY_END_HOUR = 18

export function themeFromLocalHour(hour: number): 'day' | 'night' {
  return hour >= DAY_START_HOUR && hour < DAY_END_HOUR ? 'day' : 'night'
}

export function themeFromLocalTime(now?: Date): 'day' | 'night' {
  return themeFromLocalHour((now ?? new Date()).getHours())
}

export function msUntilNextThemeBoundary(now: Date): number {
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  const hour = now.getHours()
  const next =
    hour < DAY_START_HOUR
      ? new Date(y, m, d, DAY_START_HOUR, 0, 0, 0)
      : hour < DAY_END_HOUR
        ? new Date(y, m, d, DAY_END_HOUR, 0, 0, 0)
        : new Date(y, m, d + 1, DAY_START_HOUR, 0, 0, 0)
  return next.getTime() - now.getTime()
}
