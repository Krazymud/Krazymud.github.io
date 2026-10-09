import { afterEach, describe, expect, it, vi } from 'vitest'
import { emitIgnition, emitNitro, isIgnitionPending, onIgnition, onNitro, setIgnitionPending } from './events'

afterEach(() => vi.restoreAllMocks())

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

  it('keeps reaching the other subscribers when one throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const offBroken = onNitro(() => {
      throw new Error('broken')
    })
    const listener = vi.fn()
    const off = onNitro(listener)
    emitNitro()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    offBroken()
    off()
  })

  it('only reaches the subscribers present when it fires', () => {
    const late = vi.fn()
    let offLate = () => {}
    const off = onNitro(() => {
      offLate = onNitro(late)
    })
    emitNitro()
    expect(late).not.toHaveBeenCalled()
    off()
    offLate()
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

  it('keeps reaching the other subscribers when one throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const offBroken = onIgnition(() => {
      throw new Error('broken')
    })
    const listener = vi.fn()
    const off = onIgnition(listener)
    emitIgnition()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    offBroken()
    off()
  })

  it('only reaches the subscribers present when it fires', () => {
    const late = vi.fn()
    let offLate = () => {}
    const off = onIgnition(() => {
      offLate = onIgnition(late)
    })
    emitIgnition()
    expect(late).not.toHaveBeenCalled()
    off()
    offLate()
  })
})
