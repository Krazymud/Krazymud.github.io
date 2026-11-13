import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { copy } from '../../config/copy'
import { HOLD_MS, UnlockPanel } from './UnlockPanel'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => motion.reduced,
}))

function renderPanel() {
  const onUnlock = vi.fn(async () => true)
  render(<UnlockPanel canRemember onUnlock={onUnlock} />)
  fireEvent.change(screen.getByLabelText('口令'), { target: { value: 'iceland aurora penguin goodnight' } })
  return onUnlock
}

describe('UnlockPanel', () => {
  afterEach(() => {
    vi.useRealTimers()
    motion.reduced = false
  })

  it('shows cinematic darkroom unlock without legacy glass vault chrome', () => {
    render(<UnlockPanel canRemember onUnlock={vi.fn(async () => true)} />)
    expect(screen.getByText(copy.siteName)).toBeInTheDocument()
    expect(screen.queryByText('PRIVATE VAULT')).not.toBeInTheDocument()
    expect(screen.getByTestId('unlock-panel').className).toMatch(/dr-stage/)
    expect(screen.getByRole('button', { name: copy.darkroom.unseal })).toBeInTheDocument()
    expect(screen.getByText('宝宝，往下看')).toBeInTheDocument()
  })

  it('does not offer to save the passphrase', () => {
    renderPanel()
    expect(screen.getByLabelText('口令')).toHaveAttribute('autocomplete', 'off')
  })

  it('submits once when a second touch starts during a hold', () => {
    vi.useFakeTimers()
    const onUnlock = renderPanel()
    const button = screen.getByRole('button', { name: '启封' })
    fireEvent.pointerDown(button)
    fireEvent.pointerDown(button)
    act(() => {
      vi.advanceTimersByTime(HOLD_MS)
    })
    expect(onUnlock).toHaveBeenCalledTimes(1)
  })

  it('starts with a single click when motion is reduced', () => {
    motion.reduced = true
    const onUnlock = renderPanel()
    expect(screen.getByText('点一下启封')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '启封' }))
    expect(onUnlock).toHaveBeenCalledWith('iceland aurora penguin goodnight', true)
  })
})
