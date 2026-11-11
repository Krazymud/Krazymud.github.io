import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OpeningScene } from './OpeningScene'

describe('OpeningScene', () => {
  it('renders title and handwritten CTA', () => {
    render(<OpeningScene onContinue={() => {}} beltUrls={[]} />)
    expect(screen.getByRole('heading', { name: '暗房' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /roll it, darling/i })).toBeInTheDocument()
  })

  it('calls onContinue when CTA is clicked', () => {
    const onContinue = vi.fn()
    render(<OpeningScene onContinue={onContinue} beltUrls={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /roll it, darling/i }))
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('shows vertical film belt frames when beltUrls are provided', () => {
    render(<OpeningScene onContinue={() => {}} beltUrls={['blob:a', 'blob:b']} />)
    const belt = screen.getByTestId('opening-belt')
    expect(belt.querySelectorAll('img')).toHaveLength(4) // duplicated for continuous roll
  })

  it('shows placeholder film frames when beltUrls are empty', () => {
    render(<OpeningScene onContinue={() => {}} beltUrls={[]} />)
    const belt = screen.getByTestId('opening-belt')
    // belt duplicates frames for continuous roll animation
    expect(belt.querySelectorAll('.dr-opening-fr').length).toBeGreaterThanOrEqual(4)
  })
})
