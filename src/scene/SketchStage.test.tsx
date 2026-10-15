import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HOME_STAGE_ATTR, NARROW_MAX_WIDTH_MQ, ROUTE_FADE_MS, SketchStage } from './SketchStage'

type MediaOpts = { reduce?: boolean; narrow?: boolean }

const media = ({ reduce = false, narrow = false }: MediaOpts = {}) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches:
      (reduce && query.includes('reduce')) ||
      (narrow && query === NARROW_MAX_WIDTH_MQ),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))

function mountHomeStageSlot() {
  const slot = document.createElement('div')
  slot.setAttribute(HOME_STAGE_ATTR, '')
  slot.setAttribute('data-testid', 'home-stage')
  document.body.appendChild(slot)
  return slot
}

describe('SketchStage', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    delete document.documentElement.dataset.sketchFit
    delete document.documentElement.dataset.sketchPlacement
    document.querySelectorAll(`[${HOME_STAGE_ATTR}]`).forEach((el) => el.remove())
  })

  it('stays on still when not on home', () => {
    media()
    render(<SketchStage playLoop={false} />)
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'still')
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-route', 'inner')
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-fit', 'a')
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-placement', 'bleed')
  })

  it('requests the drive loop on desktop home when motion is allowed', () => {
    media({ narrow: false })
    render(<SketchStage playLoop />)
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'loop')
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-route', 'home')
    const video = document.querySelector('video')
    expect(video).toBeTruthy()
    const sources = [...video!.querySelectorAll('source')].map((s) => s.getAttribute('src') ?? '')
    expect(sources[0]).toEqual(expect.stringContaining('fc-drive-loop.mp4'))
    expect(sources.some((s) => s.includes('fc-drive-loop.webm'))).toBe(true)
    expect(video!.muted).toBe(true)
    expect(video!.playsInline).toBe(true)
    expect(video).toHaveAttribute('playsinline')
    expect(video).toHaveAttribute('webkit-playsinline')
    expect(video).toHaveAttribute('x5-playsinline', 'true')
    expect(video).toHaveAttribute('aria-hidden', 'true')
  })

  it('keeps the still until the video reports playing', () => {
    media({ narrow: false })
    render(<SketchStage playLoop />)
    const video = document.querySelector('video')!
    const img = [...document.querySelectorAll('img')].at(-1) as HTMLImageElement
    expect(img.style.opacity).toBe('1')
    expect(video.style.opacity).toBe('0')
    fireEvent(video, new Event('playing'))
    expect(img.style.opacity).toBe('0')
    expect(video.style.opacity).toBe('1')
  })

  it('restarts playback at end so iOS Safari keeps looping', () => {
    media({ narrow: false })
    render(<SketchStage playLoop />)
    const video = document.querySelector('video') as HTMLVideoElement
    const play = vi.spyOn(video, 'play').mockResolvedValue(undefined)
    Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: 9.9 })
    fireEvent(video, new Event('ended'))
    expect(video.currentTime).toBe(0)
    expect(play).toHaveBeenCalled()
  })

  it('retries play on a user gesture when autoplay was blocked', () => {
    media({ narrow: false })
    render(<SketchStage playLoop />)
    const video = document.querySelector('video') as HTMLVideoElement
    const play = vi.spyOn(video, 'play').mockResolvedValue(undefined)
    Object.defineProperty(video, 'paused', { configurable: true, get: () => true })
    play.mockClear()
    fireEvent(document, new Event('touchstart', { bubbles: true }))
    expect(play).toHaveBeenCalled()
  })

  it('retries play when WeChat pauses after showing the first frame', () => {
    media({ narrow: false })
    render(<SketchStage playLoop />)
    const video = document.querySelector('video') as HTMLVideoElement
    const play = vi.spyOn(video, 'play').mockResolvedValue(undefined)
    Object.defineProperty(video, 'paused', { configurable: true, get: () => true })
    Object.defineProperty(video, 'currentTime', { configurable: true, value: 0.01 })
    Object.defineProperty(video, 'duration', { configurable: true, value: 10 })
    play.mockClear()
    fireEvent(video, new Event('playing'))
    fireEvent(video, new Event('pause'))
    expect(play).toHaveBeenCalled()
  })

  it('reveals the loop when playback is already running without a playing event', async () => {
    vi.useFakeTimers()
    media({ narrow: false })
    render(<SketchStage playLoop />)
    const video = document.querySelector('video') as HTMLVideoElement
    const img = [...document.querySelectorAll('img')].at(-1) as HTMLImageElement
    vi.spyOn(video, 'play').mockResolvedValue(undefined)
    Object.defineProperty(video, 'paused', { configurable: true, get: () => false })
    expect(img.style.opacity).toBe('1')
    expect(video.style.opacity).toBe('0')
    await vi.advanceTimersByTimeAsync(300)
    expect(img.style.opacity).toBe('0')
    expect(video.style.opacity).toBe('1')
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'loop')
    vi.useRealTimers()
  })

  it('applies route fade transition on both layers during loop exit', () => {
    media({ narrow: false })
    const { rerender } = render(<SketchStage playLoop />)
    fireEvent(document.querySelector('video')!, new Event('playing'))
    rerender(<SketchStage playLoop={false} />)
    const imgs = document.querySelectorAll('img')
    const video = document.querySelector('video')
    expect(video).toBeTruthy()
    const sharp = imgs[imgs.length - 1] as HTMLImageElement
    expect(sharp.style.transition).toContain(`${ROUTE_FADE_MS}ms`)
    expect(video!.style.transition).toContain(`${ROUTE_FADE_MS}ms`)
  })

  it('applies route fade transition on both layers when entering loop', () => {
    media({ narrow: false })
    const { rerender } = render(<SketchStage playLoop={false} />)
    rerender(<SketchStage playLoop />)
    const imgs = document.querySelectorAll('img')
    const video = document.querySelector('video')
    expect(video).toBeTruthy()
    const sharp = imgs[imgs.length - 1] as HTMLImageElement
    expect(sharp.style.transition).toContain(`${ROUTE_FADE_MS}ms`)
    expect(video!.style.transition).toContain(`${ROUTE_FADE_MS}ms`)
  })

  it('exposes a 300ms route fade constant', async () => {
    const mod = await import('./SketchStage')
    expect(mod.ROUTE_FADE_MS).toBe(300)
  })

  it('shows a static frame when reduced motion is preferred even on home', () => {
    media({ reduce: true })
    render(<SketchStage playLoop />)
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'still')
    expect(document.querySelector('video')).toBeNull()
    expect(document.querySelectorAll('img').length).toBeGreaterThanOrEqual(2)
  })

  it('falls back to the still frame when the loop video fails to load', () => {
    media({ narrow: false })
    render(<SketchStage playLoop />)
    const video = document.querySelector('video')!
    fireEvent(video, new Event('playing'))
    fireEvent.error(video)
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'still')
    const sharp = [...document.querySelectorAll('img')].at(-1) as HTMLImageElement
    expect(sharp.style.opacity).toBe('1')
    expect(video.style.opacity).toBe('0')
  })

  it('uses a 16:9 sharp wrap plus blurred ambience fill in bleed mode', () => {
    media({ narrow: false })
    render(<SketchStage playLoop={false} />)
    const stage = screen.getByTestId('sketch-stage')
    expect(stage).toHaveAttribute('data-fit', 'a')
    expect(stage).toHaveAttribute('data-placement', 'bleed')
    expect(stage.className).toMatch(/fixed/)
    expect(stage.querySelector('.sketch-ambience-tint')).toBeTruthy()
    expect(stage.querySelector('.sketch-ambience')).toBeTruthy()
    expect(stage.querySelector('.sketch-paper-noise')).toBeTruthy()
    const wrap = screen.getByTestId('sketch-sharp-wrap')
    expect(wrap.className).toMatch(/sketch-sharp-wrap/)
    expect(wrap.className).not.toMatch(/sketch-sharp-wrap-dock/)
    expect(document.documentElement.dataset.sketchFit).toBe('a')
  })

  it('waits for the home stage slot before mounting video on narrow home', () => {
    media({ narrow: true })
    render(<SketchStage playLoop />)
    expect(document.querySelector('video')).toBeNull()
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-video-ready', '0')
  })

  it('docks into the home stage slot with video once the slot exists', async () => {
    media({ narrow: true })
    const slot = mountHomeStageSlot()
    render(<SketchStage playLoop />)

    await vi.waitFor(() => {
      expect(slot.querySelector('[data-testid="sketch-stage"]')).toBeTruthy()
    })
    const stage = slot.querySelector('[data-testid="sketch-stage"]')!
    expect(stage).toHaveAttribute('data-placement', 'dock')
    expect(stage).toHaveAttribute('data-video-ready', '1')
    expect(stage.className).toMatch(/absolute/)
    expect(stage.className).not.toMatch(/fixed/)
    expect(stage.querySelector('[data-testid="sketch-a-blend"]')).toBeTruthy()
    expect(stage.querySelector('.sketch-ambience-tint')).toBeTruthy()
    expect(stage.querySelector('.sketch-ambience')).toBeTruthy()
    expect(stage.querySelector('.sketch-paper-noise')).toBeTruthy()
    expect(stage.querySelector('.sketch-sharp-wrap-dock')).toBeTruthy()
    expect(stage.querySelector('video')).toBeTruthy()
    expect(document.documentElement.dataset.sketchPlacement).toBe('dock')
  })
})
