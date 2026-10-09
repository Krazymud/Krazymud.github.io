import { describe, expect, it, vi } from 'vitest'
import { emitIgnition, emitNitro, isIgnitionPending, onIgnition, onNitro, setIgnitionPending } from './events'

describe('nitro events', () => {
  it('reaches subscribers until they unsubscribe', () => {
    const listener = vi.fn()
    const off = onNitro(listener)
    emitNitro()
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    emitNitro()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('ignition events', () => {
  it('clears the pending flag and reaches subscribers', () => {
    const listener = vi.fn()
    const off = onIgnition(listener)
    setIgnitionPending(true)
    expect(isIgnitionPending()).toBe(true)
    emitIgnition()
    expect(isIgnitionPending()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    emitIgnition()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
