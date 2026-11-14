import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UnlockPanel } from './UnlockPanel'

function renderPanel() {
  const onUnlock = vi.fn(async () => true)
  render(<UnlockPanel canRemember onUnlock={onUnlock} />)
  fireEvent.change(screen.getByLabelText('口令'), { target: { value: 'iceland aurora penguin goodnight' } })
  return onUnlock
}

describe('UnlockPanel', () => {
  it('is a passphrase dialog, not another full-screen page', () => {
    render(<UnlockPanel canRemember onUnlock={vi.fn(async () => true)} />)
    const dialog = screen.getByRole('dialog', { name: '请输入口令' })
    expect(dialog.className).not.toMatch(/min-h-dvh/)
    expect(screen.queryByText('宝宝，往下看')).not.toBeInTheDocument()
    expect(screen.queryByText('PRIVATE VAULT')).not.toBeInTheDocument()
  })

  it('does not offer to save the passphrase', () => {
    renderPanel()
    expect(screen.getByLabelText('口令')).toHaveAttribute('autocomplete', 'off')
  })

  it('submits the typed passphrase', () => {
    const onUnlock = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: '进入' }))
    expect(onUnlock).toHaveBeenCalledWith('iceland aurora penguin goodnight', true)
  })
})
