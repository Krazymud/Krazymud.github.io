import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BookCoverScene } from './BookCoverScene'

vi.mock('@react-three/fiber', () => ({
  Canvas: () => <div data-testid="book-r3f-canvas" />,
}))

describe('BookCoverScene', () => {
  it('renders stage, canvas shell, and continue', () => {
    render(<BookCoverScene title="远行" byline="—— 暗房" onContinue={() => {}} />)
    expect(screen.getByTestId('book-cover-stage')).toBeInTheDocument()
    expect(screen.getByTestId('book-r3f-canvas')).toBeInTheDocument()
    expect(screen.getByText('远行')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /继续|片尾/i })).toBeInTheDocument()
  })

  it('calls onContinue when CTA is clicked', () => {
    const onContinue = vi.fn()
    render(<BookCoverScene title="相册" byline="暗房" onContinue={onContinue} />)
    fireEvent.click(screen.getByRole('button', { name: /继续|片尾/i }))
    expect(onContinue).toHaveBeenCalledOnce()
  })
})
