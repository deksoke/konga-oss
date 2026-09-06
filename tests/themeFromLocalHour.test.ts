import { describe, expect, it } from 'vitest'
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  msUntilNextThemeBoundary,
  themeFromLocalHour,
  themeFromLocalTime
} from '../utils/themeFromLocalHour'

function local(year: number, month: number, day: number, hour: number, minute = 0) {
  return new Date(year, month, day, hour, minute, 0, 0)
}

describe('themeFromLocalHour', () => {
  it.each([
    [0, 'night'],
    [5, 'night'],
    [6, 'day'],
    [12, 'day'],
    [17, 'day'],
    [18, 'night'],
    [23, 'night']
  ] as const)('hour %i → %s', (hour, expected) => {
    expect(themeFromLocalHour(hour)).toBe(expected)
  })
})

describe('themeFromLocalTime', () => {
  it('06:00 → day', () => {
    expect(themeFromLocalTime(local(2026, 0, 1, DAY_START_HOUR))).toBe('day')
  })

  it('18:00 → night', () => {
    expect(themeFromLocalTime(local(2026, 0, 1, DAY_END_HOUR))).toBe('night')
  })

  it('00:00 → night', () => {
    expect(themeFromLocalTime(local(2026, 0, 1, 0))).toBe('night')
  })

  it('05:59 → night', () => {
    expect(themeFromLocalTime(local(2026, 0, 1, 5, 59))).toBe('night')
  })

  it('17:59 → day', () => {
    expect(themeFromLocalTime(local(2026, 0, 1, 17, 59))).toBe('day')
  })
})

describe('msUntilNextThemeBoundary', () => {
  it('from 10:00 same day → 18:00', () => {
    const now = local(2026, 0, 15, 10)
    const expected = local(2026, 0, 15, DAY_END_HOUR).getTime() - now.getTime()
    expect(msUntilNextThemeBoundary(now)).toBe(expected)
  })

  it('from 20:00 → next day 06:00', () => {
    const now = local(2026, 0, 15, 20)
    const expected = local(2026, 0, 16, DAY_START_HOUR).getTime() - now.getTime()
    expect(msUntilNextThemeBoundary(now)).toBe(expected)
  })

  it('from exactly 06:00 → 18:00 same day', () => {
    const now = local(2026, 0, 15, DAY_START_HOUR)
    const expected = local(2026, 0, 15, DAY_END_HOUR).getTime() - now.getTime()
    expect(msUntilNextThemeBoundary(now)).toBe(expected)
  })

  it('from exactly 18:00 → next 06:00', () => {
    const now = local(2026, 0, 15, DAY_END_HOUR)
    const expected = local(2026, 0, 16, DAY_START_HOUR).getTime() - now.getTime()
    expect(msUntilNextThemeBoundary(now)).toBe(expected)
  })
})
