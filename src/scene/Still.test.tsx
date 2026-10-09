import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Still, stillUrl } from './Still'

describe('Still', () => {
  it('picks the portrait image and offers the landscape one by orientation', () => {
    const { container } = render(<Still scene="garage" />)
    expect(container.querySelector('img')).toHaveAttribute('src', stillUrl('garage', 'portrait'))
    const source = container.querySelector('source')
    expect(source).toHaveAttribute('media', '(orientation: landscape)')
    expect(source).toHaveAttribute('srcset', stillUrl('garage', 'landscape'))
    expect(stillUrl('vault', 'landscape')).toBe('/stills/vault-landscape.webp')
  })

  it('falls back to the dark gradient when the image cannot load', () => {
    const { container } = render(<Still scene="track" />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByTestId('scene-still')).toBeInTheDocument()
  })

  it('brings in the new camera when the scene changes', () => {
    const { container, rerender } = render(<Still scene="garage" />)
    rerender(<Still scene="vault" />)
    const sources = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'))
    expect(sources).toContain(stillUrl('vault', 'portrait'))
  })
})
