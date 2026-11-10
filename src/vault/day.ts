const CUTOFF_HOUR = 4
const MS_PER_DAY = 86_400_000

function format(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parts(day: string): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number)
  return [y, m, d]
}

export function studyDay(now: Date): string {
  const shifted = new Date(now.getTime())
  shifted.setHours(shifted.getHours() - CUTOFF_HOUR)
  return format(shifted)
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = parts(day)
  return format(new Date(y, m - 1, d + n))
}

export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = parts(from)
  const [y2, m2, d2] = parts(to)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / MS_PER_DAY)
}
