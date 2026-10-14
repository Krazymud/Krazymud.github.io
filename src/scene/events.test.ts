import { describe, expect, it, vi } from 'vitest'
import { emitNitro, onNitro } from './events'

describe('nitro events', () => {
  it('notifies listeners and allows unsubscribe', () => {
    const listener = vi.fn()
    const off = onNitro(listener)
    emitNitro()
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    emitNitro()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('keeps notifying after one listener throws', () => {
    const bad = vi.fn(() => {
      throw new Error('boom')
    })
    const good = vi.fn()
    onNitro(bad)
    onNitro(good)
    expect(() => emitNitro()).not.toThrow()
    expect(good).toHaveBeenCalledTimes(1)
  })
})
