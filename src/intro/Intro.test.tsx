import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { play, unlockAudio } from '../audio/sound'
import { getPrefs } from '../prefs/prefs'
import { onIgnition } from '../scene/events'
import { resetLoading, setLoading } from '../scene/loading'
import { INTRO_FADE_MS, INTRO_FALLBACK_MS, INTRO_MIN_MS, Intro, STILL_FILL_MS } from './Intro'

vi.mock('../audio/sound', () => ({ play: vi.fn(async () => undefined), unlockAudio: vi.fn() }))

const ignite = () => screen.queryByRole('button', { name: '点火' })
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

describe('Intro', () => {
  beforeEach(() => {
    localStorage.clear()
    resetLoading()
    vi.useFakeTimers()
    vi.mocked(play).mockClear()
    vi.mocked(unlockAudio).mockClear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('fills the tachometer on its own in still mode and then offers ignition', () => {
    setLoading({ kind: 'still', fraction: 1 })
    render(<Intro onDone={() => {}} />)
    expect(ignite()).toBeNull()
    advance(STILL_FILL_MS)
    expect(screen.getByText('100%')).toBeInTheDocument()
    advance(INTRO_MIN_MS - STILL_FILL_MS)
    expect(ignite()).toBeInTheDocument()
  })

  it('follows the 3D loading progress', () => {
    render(<Intro onDone={() => {}} />)
    act(() => setLoading({ kind: '3d', fraction: 0.65 }))
    advance(INTRO_MIN_MS)
    expect(screen.getByText('65%')).toBeInTheDocument()
    expect(ignite()).toBeNull()
    act(() => setLoading({ kind: '3d', fraction: 1 }))
    expect(ignite()).toBeInTheDocument()
  })

  it('offers ignition anyway after 8 seconds', () => {
    render(<Intro onDone={() => {}} />)
    act(() => setLoading({ kind: '3d', fraction: 0.4 }))
    advance(INTRO_FALLBACK_MS)
    expect(ignite()).toHaveFocus()
  })

  it('starts the engine, lights up and remembers the intro', () => {
    const lit = vi.fn()
    const off = onIgnition(lit)
    const onDone = vi.fn()
    setLoading({ kind: 'still', fraction: 1 })
    render(<Intro onDone={onDone} />)
    advance(INTRO_MIN_MS)
    fireEvent.click(ignite()!)
    expect(unlockAudio).toHaveBeenCalled()
    expect(play).toHaveBeenCalledWith('ignition')
    expect(lit).toHaveBeenCalledTimes(1)
    expect(getPrefs().introSeen).toBe(true)
    expect(onDone).not.toHaveBeenCalled()
    advance(INTRO_FADE_MS)
    expect(onDone).toHaveBeenCalledTimes(1)
    off()
  })

  it('stops ticking once ignition is offered and while fading out', () => {
    const tick = vi.spyOn(window, 'setInterval')
    const stop = vi.spyOn(window, 'clearInterval')
    setLoading({ kind: 'still', fraction: 1 })
    render(<Intro onDone={() => {}} />)
    expect(tick).toHaveBeenCalledTimes(1)
    advance(INTRO_MIN_MS)
    expect(ignite()).toBeInTheDocument()
    expect(stop).toHaveBeenCalledWith(tick.mock.results[0].value)
    fireEvent.click(ignite()!)
    advance(INTRO_FADE_MS)
    expect(tick).toHaveBeenCalledTimes(1)
  })

  it('fills at once and finishes without a fade when motion is reduced', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    const onDone = vi.fn()
    setLoading({ kind: 'still', fraction: 1 })
    render(<Intro onDone={onDone} />)
    expect(screen.getByText('100%')).toBeInTheDocument()
    advance(INTRO_MIN_MS)
    fireEvent.click(ignite()!)
    expect(screen.getByRole('dialog').style.transitionDuration).toBe('0ms')
    advance(0)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('ignites only once on a double tap', () => {
    const lit = vi.fn()
    const off = onIgnition(lit)
    const onDone = vi.fn()
    setLoading({ kind: 'still', fraction: 1 })
    render(<Intro onDone={onDone} />)
    advance(INTRO_MIN_MS)
    const button = ignite()!
    act(() => {
      fireEvent.click(button)
      fireEvent.click(button)
    })
    expect(play).toHaveBeenCalledTimes(1)
    expect(lit).toHaveBeenCalledTimes(1)
    advance(INTRO_FADE_MS)
    expect(onDone).toHaveBeenCalledTimes(1)
    off()
  })

  it('does not finish after it has been removed mid-fade', () => {
    const onDone = vi.fn()
    setLoading({ kind: 'still', fraction: 1 })
    const { unmount } = render(<Intro onDone={onDone} />)
    advance(INTRO_MIN_MS)
    fireEvent.click(ignite()!)
    unmount()
    advance(INTRO_FADE_MS)
    expect(onDone).not.toHaveBeenCalled()
  })
})
