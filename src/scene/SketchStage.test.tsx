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
    expect(document.querySelector('img')!).toHaveAttribute('src', expect.stringContaining('fc-still'))
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'still')
  })

  it('plays the loop otherwise', () => {
    media(false)
    render(<SketchStage />)
    expect(screen.getByTestId('sketch-stage')).toHaveAttribute('data-motion', 'loop')
    expect(document.querySelector('img')).toHaveAttribute('aria-hidden', 'true')
  })
})
