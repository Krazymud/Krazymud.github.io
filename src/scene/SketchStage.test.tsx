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
    const imgs = document.querySelectorAll('img')
    expect(imgs).toHaveLength(1)
    expect(imgs[0]).toHaveAttribute('src', expect.stringContaining('fc-still'))
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'still')
  })

  it('crossfades headlights over a multi-second loop otherwise', () => {
    media(false)
    render(<SketchStage />)
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'loop')
    const imgs = [...document.querySelectorAll('img')]
    expect(imgs.map((img) => img.getAttribute('src'))).toEqual([
      expect.stringContaining('fc-still'),
      expect.stringContaining('fc-up'),
    ])
    expect(imgs[1]).toHaveClass('sketch-headlights')
    expect(imgs.every((img) => img.getAttribute('aria-hidden') === 'true')).toBe(true)
  })
})
