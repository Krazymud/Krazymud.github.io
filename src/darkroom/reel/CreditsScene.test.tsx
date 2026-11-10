import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copy } from '../../config/copy'
import { CreditsScene } from './CreditsScene'

function stubReducedMotion(reduced: boolean) {
  const matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  vi.stubGlobal('matchMedia', matchMedia)
}

describe('CreditsScene', () => {
  beforeEach(() => stubReducedMotion(true))

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lists configurable credit lines', () => {
    render(<CreditsScene onContinue={() => {}} />)
    for (const line of copy.darkroom.creditsLines) {
      expect(screen.getByText(line)).toBeInTheDocument()
    }
    expect(screen.getByText(copy.darkroom.creditsSignoff)).toBeInTheDocument()
  })

  it('shows stills when stillUrls are provided', () => {
    render(<CreditsScene onContinue={() => {}} stillUrls={['blob:still-1']} />)
    expect(screen.getByTestId('credits-stills').querySelectorAll('img')).toHaveLength(1)
  })

  it('uses static rollup when prefers reduced motion', () => {
    render(<CreditsScene onContinue={() => {}} />)
    expect(screen.getByTestId('credits-scene')).toHaveAttribute('data-rollup', 'static')
  })

  it('advances on continue', () => {
    const onContinue = vi.fn()
    render(<CreditsScene onContinue={onContinue} />)
    fireEvent.click(screen.getByRole('button', { name: /继续/ }))
    expect(onContinue).toHaveBeenCalledOnce()
  })
})
