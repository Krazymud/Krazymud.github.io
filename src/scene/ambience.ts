export interface Ambience {
  key: string
  keyScale: number
  env: number
  strips: number
  tint: string
  tintAlpha: number
}

export const AMBIENCE_REFRESH_MS = 60_000

export const NIGHT: Ambience = { key: '#9e1c22', keyScale: 1, env: 1, strips: 1, tint: '#000000', tintAlpha: 0 }

const KEYS: readonly { hour: number; value: Ambience }[] = [
  { hour: 2, value: NIGHT },
  { hour: 7, value: { key: '#b4442a', keyScale: 1.1, env: 1.15, strips: 0.7, tint: '#ff9a55', tintAlpha: 0.1 } },
  { hour: 13, value: { key: '#b85a4e', keyScale: 1.3, env: 1.4, strips: 0.45, tint: '#fff2e0', tintAlpha: 0.12 } },
  { hour: 19, value: { key: '#a8361f', keyScale: 1.1, env: 1.1, strips: 0.85, tint: '#ffb347', tintAlpha: 0.1 } },
]

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)

function channels(hex: string): number[] {
  return [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255))
}

function mixHex(a: string, b: string, t: number): string {
  const ca = channels(a)
  const cb = channels(b)
  return `#${ca
    .map((v, i) => Math.round(toSrgb(v + (cb[i] - v) * t) * 255).toString(16).padStart(2, '0'))
    .join('')}`
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t

export function ambienceAt(date: Date): Ambience {
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  const index = KEYS.findIndex((k, i) => {
    const next = KEYS[(i + 1) % KEYS.length].hour + (i === KEYS.length - 1 ? 24 : 0)
    const h = hour < KEYS[0].hour ? hour + 24 : hour
    return h >= k.hour && h < next
  })
  const from = KEYS[index]
  const to = KEYS[(index + 1) % KEYS.length]
  const span = (to.hour - from.hour + 24) % 24
  const h = hour < KEYS[0].hour ? hour + 24 : hour
  const t = (h - from.hour) / span
  if (t === 0) return from.value
  const a = from.value
  const b = to.value
  return {
    key: mixHex(a.key, b.key, t),
    keyScale: mix(a.keyScale, b.keyScale, t),
    env: mix(a.env, b.env, t),
    strips: mix(a.strips, b.strips, t),
    tint: mixHex(a.tint, b.tint, t),
    tintAlpha: mix(a.tintAlpha, b.tintAlpha, t),
  }
}
