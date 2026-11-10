import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TorchComicScene } from './TorchComicScene'

describe('TorchComicScene', () => {
  it('moves torch with pointer and exposes continue', async () => {
    render(<TorchComicScene noteLine="测试" date="11.10" onContinue={() => {}} />)
    expect(screen.getByTestId('torch-stage')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /继续|下一卷/i })).toBeInTheDocument()
  })

  it('updates torch position on pointer move', () => {
    render(<TorchComicScene noteLine="测试" date="11.10" onContinue={() => {}} />)
    const panel = screen.getByTestId('torch-panel')
    fireEvent.pointerMove(panel, { clientX: 120, clientY: 80 })
    const mask = screen.getByTestId('torch-mask')
    expect(mask.style.getPropertyValue('--mx')).toBeTruthy()
    expect(mask.style.getPropertyValue('--my')).toBeTruthy()
  })

  it('calls onContinue when CTA is clicked', () => {
    const onContinue = vi.fn()
    render(<TorchComicScene noteLine="测试" date="11.10" onContinue={onContinue} />)
    fireEvent.click(screen.getByRole('button', { name: /继续|下一卷/i }))
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('shows note line and date in revealed layer', () => {
    render(<TorchComicScene noteLine="还在数" date="2024-11-01" onContinue={() => {}} />)
    expect(screen.getByText('还在数')).toBeInTheDocument()
    expect(screen.getByText(/2024-11-01/)).toBeInTheDocument()
  })
})
