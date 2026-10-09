import { describe, expect, it, vi } from 'vitest'
import { emitNitro, onNitro } from './events'

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
