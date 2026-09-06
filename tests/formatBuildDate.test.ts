import { formatBuildDate } from '../utils/formatBuildDate'

describe('formatBuildDate', () => {
  it('hides empty values', () => {
    expect(formatBuildDate('')).toBe('')
    expect(formatBuildDate('   ')).toBe('')
    expect(formatBuildDate(undefined)).toBe('')
    expect(formatBuildDate(null)).toBe('')
  })

  it('hides invalid ISO and never returns Invalid Date', () => {
    const invalid = ['not-a-date', 'Invalid Date', '2026-09-06', '2026-13-40T99:99:99Z', 'yesterday']
    for (const value of invalid) {
      const result = formatBuildDate(value)
      expect(result).toBe('')
      expect(result).not.toContain('Invalid Date')
    }
  })

  it('formats a valid UTC ISO stamp in local time', () => {
    const iso = '2026-09-06T07:30:00Z'
    const local = new Date(iso)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const offsetMinutes = -local.getTimezoneOffset()
    const sign = offsetMinutes >= 0 ? '+' : '-'
    const abs = Math.abs(offsetMinutes)
    const offsetHours = Math.floor(abs / 60)
    const offsetMins = abs % 60
    const gmt =
      offsetMins === 0 ? `GMT${sign}${offsetHours}` : `GMT${sign}${offsetHours}:${String(offsetMins).padStart(2, '0')}`
    const expected = `Built ${local.getDate()} ${months[local.getMonth()]} ${local.getFullYear()}, ${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')} ${gmt}`

    expect(formatBuildDate(iso)).toBe(expected)
    expect(formatBuildDate(iso)).not.toContain('Invalid Date')
  })
})
