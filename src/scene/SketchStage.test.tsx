import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ROUTE_FADE_MS, SketchStage } from './SketchStage'

const media = (reduce: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('reduce'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))

describe('SketchStage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete document.documentElement.dataset.sketchFit
  })

  it('stays on still when not on home', () => {
    media(false)
    render(<SketchStage playLoop={false} />)
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'still')
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-route', 'inner')
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-fit', 'a')
  })

  it('requests the drive loop on home when motion is allowed', () => {
    media(false)
    render(<SketchStage playLoop />)
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'loop')
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-route', 'home')
    const video = document.querySelector('video')
    expect(video).toBeTruthy()
    // Prefer mp4 first for iOS Safari (webm-first source lists are flaky there).
    const sources = [...video!.querySelectorAll('source')].map((s) => s.getAttribute('src') ?? '')
    expect(sources[0]).toEqual(expect.stringContaining('fc-drive-loop.mp4'))
    expect(sources.some((s) => s.includes('fc-drive-loop.webm'))).toBe(true)
    expect(video!.muted).toBe(true)
    expect(video!.playsInline).toBe(true)
    expect(video).toHaveAttribute('playsinline')
    expect(video).toHaveAttribute('webkit-playsinline')
    expect(video).toHaveAttribute('aria-hidden', 'true')
  })

  it('restarts playback at end so iOS Safari keeps looping', () => {
    media(false)
    render(<SketchStage playLoop />)
    const video = document.querySelector('video') as HTMLVideoElement
    const play = vi.spyOn(video, 'play').mockResolvedValue(undefined)
    Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: 9.9 })
    fireEvent(video, new Event('ended'))
    expect(video.currentTime).toBe(0)
    expect(play).toHaveBeenCalled()
  })

  it('applies route fade transition on both layers during loop exit', () => {
    media(false)
    const { rerender } = render(<SketchStage playLoop />)
    rerender(<SketchStage playLoop={false} />)
    const imgs = document.querySelectorAll('img')
    const video = document.querySelector('video')
    expect(video).toBeTruthy()
    // Last img is the sharp still layer (ambience img has no opacity transition).
    const sharp = imgs[imgs.length - 1] as HTMLImageElement
    expect(sharp.style.transition).toContain(`${ROUTE_FADE_MS}ms`)
    expect(video!.style.transition).toContain(`${ROUTE_FADE_MS}ms`)
  })

  it('applies route fade transition on both layers when entering loop', () => {
    media(false)
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
    media(true)
    render(<SketchStage playLoop />)
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'still')
    expect(document.querySelector('video')).toBeNull()
    expect(document.querySelectorAll('img').length).toBeGreaterThanOrEqual(2)
  })

  it('falls back to the still frame when the loop video fails to load', () => {
    media(false)
    render(<SketchStage playLoop />)
    const video = document.querySelector('video')!
    fireEvent.error(video)
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'still')
    const sharp = [...document.querySelectorAll('img')].at(-1) as HTMLImageElement
    expect(sharp.style.opacity).toBe('1')
    expect(video.style.opacity).toBe('0')
  })

  it('uses a 16:9 sharp wrap plus blurred ambience fill on narrow A fit', () => {
    media(false)
    render(<SketchStage playLoop={false} />)
    const stage = screen.getByTestId('sketch-stage')
    expect(stage).toHaveAttribute('data-fit', 'a')
    expect(stage.className).toMatch(/min-h-\[100dvh\]|min-h-dvh|h-\[100dvh\]/)
    expect(stage.querySelector('.sketch-ambience-tint')).toBeTruthy()
    expect(stage.querySelector('.sketch-ambience')).toBeTruthy()
    expect(stage.querySelector('.sketch-paper-noise')).toBeTruthy()
    const wrap = screen.getByTestId('sketch-sharp-wrap')
    expect(wrap.className).toMatch(/sketch-sharp-wrap/)
    const sharp = wrap.querySelector('img')
    expect(sharp).toBeTruthy()
    expect(sharp!.className).toMatch(/object-cover/)
    expect(document.documentElement.dataset.sketchFit).toBe('a')
  })
})
