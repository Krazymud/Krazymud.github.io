import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetLoading, setLoading } from '../scene/loading'
import { INTRO_FADE_MS } from './Intro'
import { STALL_MS } from './patience'
import { WARMUP_GRACE_MS, Warmup } from './Warmup'

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })
const gauge = () => screen.queryByRole('status', { name: '引擎预热' })

describe('Warmup', () => {
  beforeEach(() => {
    resetLoading()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays out of sight when the 3D garage is up quickly', () => {
    const onDone = vi.fn()
    render(<Warmup onDone={onDone} />)
    expect(gauge()).toBeNull()
    act(() => setLoading({ kind: '3d', fraction: 1 }))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(gauge()).toBeNull()
  })

  it('never shows for the still garage', () => {
    const onDone = vi.fn()
    setLoading({ kind: 'still', fraction: 1 })
    render(<Warmup onDone={onDone} />)
    advance(WARMUP_GRACE_MS)
    expect(gauge()).toBeNull()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('shows the loading gauge while a slow garage warms up, then fades out by itself', () => {
    const onDone = vi.fn()
    render(<Warmup onDone={onDone} />)
    act(() => setLoading({ kind: '3d', fraction: 0.4 }))
    advance(WARMUP_GRACE_MS)
    expect(gauge()).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    act(() => setLoading({ kind: '3d', fraction: 1 }))
    expect(onDone).not.toHaveBeenCalled()
    advance(INTRO_FADE_MS)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('gives up waiting once loading has stalled', () => {
    const onDone = vi.fn()
    render(<Warmup onDone={onDone} />)
    act(() => setLoading({ kind: '3d', fraction: 0.4 }))
    advance(STALL_MS)
    advance(INTRO_FADE_MS)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('keeps the gauge up on a slow network while data is still coming in', () => {
    const onDone = vi.fn()
    render(<Warmup onDone={onDone} />)
    for (const fraction of [0.2, 0.4, 0.6]) {
      advance(STALL_MS - 1000)
      act(() => setLoading({ kind: '3d', fraction }))
    }
    advance(STALL_MS - 1000)
    expect(gauge()).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
  })
})
