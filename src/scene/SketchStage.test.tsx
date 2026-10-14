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
    expect(document.querySelector('img')!).toHaveAttribute('src', expect.stringContaining('fc-drive-still'))
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
    const img = document.querySelector('img')!
    const video = document.querySelector('video')
    expect(video).toBeTruthy()
    expect(img.style.transition).toContain(`${ROUTE_FADE_MS}ms`)
    expect(video!.style.transition).toContain(`${ROUTE_FADE_MS}ms`)
  })

  it('applies route fade transition on both layers when entering loop', () => {
    media(false)
    const { rerender } = render(<SketchStage playLoop={false} />)
    rerender(<SketchStage playLoop />)
    const img = document.querySelector('img')!
    const video = document.querySelector('video')
    expect(video).toBeTruthy()
    expect(img.style.transition).toContain(`${ROUTE_FADE_MS}ms`)
    expect(video!.style.transition).toContain(`${ROUTE_FADE_MS}ms`)
  })

  it('exposes a 300ms route fade constant', async () => {
    const mod = await import('./SketchStage')
    expect(mod.ROUTE_FADE_MS).toBe(300)
  })

  it('shows a static frame when reduced motion is preferred even on home', () => {
    media(true)
    render(<SketchStage playLoop />)
    expect(document.querySelector('img')!).toHaveAttribute('src', expect.stringContaining('fc-drive-still'))
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'still')
    expect(document.querySelector('video')).toBeNull()
  })

  it('falls back to the still frame when the loop video fails to load', () => {
    media(false)
    render(<SketchStage playLoop />)
    const video = document.querySelector('video')!
    fireEvent.error(video)
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'still')
    expect(document.querySelector('img')!.style.opacity).toBe('1')
    expect(video.style.opacity).toBe('0')
  })

  it('A 融边 keeps contain + paper noise on narrow viewports', () => {
    media(false)
    render(<SketchStage playLoop={false} fit="a" />)
    const stage = screen.getByTestId('sketch-stage')
    expect(stage).toHaveAttribute('data-fit', 'a')
    expect(stage.className).toMatch(/min-h-\[100dvh\]|min-h-dvh|h-\[100dvh\]/)
    const img = document.querySelector('img')!
    expect(img.className).toMatch(/object-contain/)
    expect(img.className).toMatch(/sketch-fit-a-media/)
    expect(img.className).toMatch(/sm:object-cover/)
    expect(stage.querySelector('.sketch-paper-noise')).toBeTruthy()
    expect(document.documentElement.dataset.sketchFit).toBe('a')
  })

  it('C 折中微裁 scales cover so the plate can soft-crop the car', () => {
    media(false)
    render(<SketchStage playLoop={false} fit="c" />)
    const stage = screen.getByTestId('sketch-stage')
    expect(stage).toHaveAttribute('data-fit', 'c')
    const img = document.querySelector('img')!
    expect(img.className).toMatch(/object-cover/)
    expect(img.className).toMatch(/scale-\[1\.1\]/)
    expect(stage.querySelector('.sketch-paper-noise')).toBeNull()
    expect(document.documentElement.dataset.sketchFit).toBe('c')
  })
})
