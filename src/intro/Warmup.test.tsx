import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetLoading, setLoading } from '../scene/loading'
import { INTRO_FADE_MS, INTRO_FALLBACK_MS } from './Intro'
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

  it('gives up waiting after the intro fallback time', () => {
    const onDone = vi.fn()
    render(<Warmup onDone={onDone} />)
    act(() => setLoading({ kind: '3d', fraction: 0.4 }))
    advance(INTRO_FALLBACK_MS)
    advance(INTRO_FADE_MS)
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
