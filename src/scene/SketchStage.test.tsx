import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SketchStage } from './SketchStage'

const media = (reduce: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('reduce'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))

describe('SketchStage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows a static frame when reduced motion is preferred', () => {
    media(true)
    render(<SketchStage />)
    expect(document.querySelector('video')).toBeNull()
    expect(document.querySelector('img')!).toHaveAttribute('src', expect.stringContaining('fc-still'))
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'still')
  })

  it('plays a multi-frame video loop otherwise', () => {
    media(false)
    render(<SketchStage />)
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'loop')
    const video = document.querySelector('video')!
    expect(video).toHaveAttribute('autoplay')
    expect(video).toHaveAttribute('loop')
    expect(video.muted).toBe(true)
    expect(video).toHaveAttribute('playsinline')

    const sources = [...video.querySelectorAll('source')].map((s) => s.getAttribute('src'))
    expect(sources).toEqual([expect.stringContaining('fc-loop.webm'), expect.stringContaining('fc-loop.mp4')])
  })
})
