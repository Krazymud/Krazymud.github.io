import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ROUTE_FADE_MS, SketchStage } from './SketchStage'

const media = (reduce: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('reduce'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))

describe('SketchStage', () => {
  afterEach(() => vi.unstubAllGlobals())

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
    expect(video!.getAttribute('src') || video!.querySelector('source')?.getAttribute('src')).toEqual(
      expect.stringContaining('fc-drive-loop'),
    )
    expect(video!.muted).toBe(true)
    expect(video!.loop).toBe(true)
    expect(video!.playsInline).toBe(true)
    expect(video).toHaveAttribute('aria-hidden', 'true')
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

  it('anchors the crop toward the car nose', () => {
    media(false)
    render(<SketchStage playLoop={false} />)
    const img = document.querySelector('img')!
    expect(img.className).toMatch(/object-\[55%_60%\]|object-\[center_60%\]/)
  })
})
