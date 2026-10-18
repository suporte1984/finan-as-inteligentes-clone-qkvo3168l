export const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export const compactBrl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export const shortDate = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

export const monthLabel = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatDate(value: string) {
  const date =
    value.includes('T') || value.includes(' ')
      ? new Date(value.replace(' ', 'T'))
      : new Date(`${value}T12:00:00Z`)
  return shortDate.format(date)
}

export function toDateInput(value: string) {
  return value ? value.slice(0, 10) : ''
}

export function todayInput() {
  const date = new Date()
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export function currentMonth() {
  return todayInput().slice(0, 7)
}

export function monthBounds(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const start = `${month}-01 00:00:00.000Z`
  const next = new Date(Date.UTC(year, monthNumber, 1)).toISOString().replace('T', ' ')
  return { start, next }
}

export function monthTitle(month: string) {
  return monthLabel
    .format(new Date(`${month}-01T12:00:00Z`))
    .replace(/^./, (letter) => letter.toUpperCase())
}

export function escapeFilter(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export function percentageChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return ((current - previous) / Math.abs(previous)) * 100
}

export function daysUntil(value: string) {
  const target = new Date(`${value.slice(0, 10)}T12:00:00`)
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}
