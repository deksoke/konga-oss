const ISO_8601 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function gmtOffsetLabel(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMinutes)
  const hours = Math.floor(abs / 60)
  const minutes = abs % 60
  if (minutes === 0) return `GMT${sign}${hours}`
  return `GMT${sign}${hours}:${String(minutes).padStart(2, '0')}`
}

/** Parse a UTC ISO-8601 stamp and format it in the viewer's local timezone. Invalid/empty → ''. */
export function formatBuildDate(iso: string | undefined | null): string {
  if (typeof iso !== 'string') return ''
  const value = iso.trim()
  if (!value || !ISO_8601.test(value)) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const day = date.getDate()
  const month = MONTHS[date.getMonth()]
  const year = date.getFullYear()
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `Built ${day} ${month} ${year}, ${hour}:${minute} ${gmtOffsetLabel(date)}`
}
