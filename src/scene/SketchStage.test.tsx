import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DRIVE_LOOP,
  DRIVE_LOOP_PORTRAIT,
  DRIVE_STILL,
  DRIVE_STILL_PORTRAIT,
  NARROW_MAX_WIDTH_MQ,
  ROUTE_FADE_MS,
  SketchStage,
} from './SketchStage'

type MediaOpts = { reduce?: boolean; narrow?: boolean }

const media = ({ reduce = false, narrow = false }: MediaOpts = {}) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches:
      (reduce && query.includes('reduce')) ||
      (narrow && query === NARROW_MAX_WIDTH_MQ),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))

describe('SketchStage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('stays on still when not on home', () => {
    media()
    render(<SketchStage playLoop={false} />)
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'still')
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-route', 'inner')
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-plate', 'landscape')
    expect(document.querySelector('img')!).toHaveAttribute('src', DRIVE_STILL)
  })

  it('requests the landscape drive loop on home when motion is allowed', () => {
    media()
    render(<SketchStage playLoop />)
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'loop')
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-route', 'home')
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-plate', 'landscape')
    const video = document.querySelector('video')
    expect(video).toBeTruthy()
    // Prefer mp4 first for iOS Safari (webm-first source lists are flaky there).
    const sources = [...video!.querySelectorAll('source')].map((s) => s.getAttribute('src') ?? '')
    expect(sources[0]).toEqual(expect.stringContaining('fc-drive-loop.mp4'))
    expect(sources.some((s) => s.includes('fc-drive-loop.webm'))).toBe(true)
    expect(sources[0]).not.toContain('portrait')
    expect(sources.some((s) => s === DRIVE_LOOP || s.includes('fc-drive-loop.webm'))).toBe(true)
    expect(video!.muted).toBe(true)
    expect(video!.playsInline).toBe(true)
    expect(video).toHaveAttribute('playsinline')
    expect(video).toHaveAttribute('webkit-playsinline')
    expect(video).toHaveAttribute('aria-hidden', 'true')
  })

  it('uses portrait still and loop sources on narrow viewports', () => {
    media({ narrow: true })
    render(<SketchStage playLoop />)
    const stage = screen.getByTestId('sketch-stage')
    expect(stage).toHaveAttribute('data-plate', 'portrait')
    expect(document.querySelector('img')!).toHaveAttribute('src', DRIVE_STILL_PORTRAIT)
    const video = document.querySelector('video')!
    const sources = [...video.querySelectorAll('source')].map((s) => s.getAttribute('src') ?? '')
    expect(sources[0]).toEqual(expect.stringContaining('fc-drive-loop-portrait.mp4'))
    expect(sources.some((s) => s === DRIVE_LOOP_PORTRAIT || s.includes('fc-drive-loop-portrait.webm'))).toBe(
      true,
    )
  })

  it('covers the viewport on both plates (no contain letterboxing)', () => {
    media({ narrow: true })
    render(<SketchStage playLoop={false} />)
    const stage = screen.getByTestId('sketch-stage')
    expect(stage.className).toMatch(/min-h-\[100dvh\]|min-h-dvh|h-\[100dvh\]/)
    const img = document.querySelector('img')!
    expect(img.className).toMatch(/object-cover/)
    expect(img.className).not.toMatch(/object-contain/)
    expect(img.className).toMatch(/object-center/)
  })

  it('restarts playback at end so iOS Safari keeps looping', () => {
    media()
    render(<SketchStage playLoop />)
    const video = document.querySelector('video') as HTMLVideoElement
    const play = vi.spyOn(video, 'play').mockResolvedValue(undefined)
    Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: 9.9 })
    fireEvent(video, new Event('ended'))
    expect(video.currentTime).toBe(0)
    expect(play).toHaveBeenCalled()
  })

  it('applies route fade transition on both layers during loop exit', () => {
    media()
    const { rerender } = render(<SketchStage playLoop />)
    rerender(<SketchStage playLoop={false} />)
    const img = document.querySelector('img')!
    const video = document.querySelector('video')
    expect(video).toBeTruthy()
    expect(img.style.transition).toContain(`${ROUTE_FADE_MS}ms`)
    expect(video!.style.transition).toContain(`${ROUTE_FADE_MS}ms`)
  })

  it('applies route fade transition on both layers when entering loop', () => {
    media()
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
    media({ reduce: true })
    render(<SketchStage playLoop />)
    expect(document.querySelector('img')!).toHaveAttribute('src', DRIVE_STILL)
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'still')
    expect(document.querySelector('video')).toBeNull()
  })

  it('falls back to the still frame when the loop video fails to load', () => {
    media()
    render(<SketchStage playLoop />)
    const video = document.querySelector('video')!
    fireEvent.error(video)
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'still')
    expect(document.querySelector('img')!.style.opacity).toBe('1')
    expect(video.style.opacity).toBe('0')
  })
})
