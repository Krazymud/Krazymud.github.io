import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

  it('does not offer to save the passphrase', () => {
    renderPanel()
    expect(screen.getByLabelText('口令')).toHaveAttribute('autocomplete', 'off')
  })

  it('submits once when a second touch starts during a hold', () => {
    vi.useFakeTimers()
    const onUnlock = renderPanel()
    const button = screen.getByRole('button', { name: '一键启动' })
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
    expect(screen.getByText('点一下启动')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '一键启动' }))
    expect(onUnlock).toHaveBeenCalledWith('iceland aurora penguin goodnight', true)
  })
})
