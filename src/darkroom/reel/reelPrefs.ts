export const CLARITY_KEY = 'darkroom.q'
export const LIGHT_KEY = 'darkroom.light'

export type ClarityLevel = '1' | '2'
export type LightMode = 'full' | 'simple'

const CLARITY_EVENT = 'darkroom:clarity'
const LIGHT_EVENT = 'darkroom:light'

export function readClarity(): ClarityLevel {
  if (typeof window === 'undefined') return '2'
  const raw = localStorage.getItem(CLARITY_KEY)
  return raw === '1' ? '1' : '2'
}

export function writeClarity(level: ClarityLevel) {
  localStorage.setItem(CLARITY_KEY, level)
  window.dispatchEvent(new CustomEvent(CLARITY_EVENT, { detail: level }))
}

export function readLightMode(): LightMode {
  if (typeof window === 'undefined') return 'full'
  const raw = localStorage.getItem(LIGHT_KEY)
  return raw === 'simple' ? 'simple' : 'full'
}

export function writeLightMode(mode: LightMode) {
  localStorage.setItem(LIGHT_KEY, mode)
  window.dispatchEvent(new CustomEvent(LIGHT_EVENT, { detail: mode }))
}

export function onClarityChange(handler: (level: ClarityLevel) => void) {
  const fn = (e: Event) => handler((e as CustomEvent<ClarityLevel>).detail)
  window.addEventListener(CLARITY_EVENT, fn)
  return () => window.removeEventListener(CLARITY_EVENT, fn)
}

export function onLightModeChange(handler: (mode: LightMode) => void) {
  const fn = (e: Event) => handler((e as CustomEvent<LightMode>).detail)
  window.addEventListener(LIGHT_EVENT, fn)
  return () => window.removeEventListener(LIGHT_EVENT, fn)
}

export function clarityToDpr(level: ClarityLevel): [number, number] {
  return level === '1' ? [1, 1] : [1, 2]
}
