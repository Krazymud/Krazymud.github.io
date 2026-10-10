import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOOR_MS, VaultDoor } from './VaultDoor'

describe('VaultDoor', () => {
  afterEach(() => vi.useRealTimers())

  it('finishes on its own after the animation', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<VaultDoor onDone={onDone} />)
    act(() => {
      vi.advanceTimersByTime(DOOR_MS - 1)
    })
    expect(onDone).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('skips on a tap and stays out of the accessibility tree', () => {
    const onDone = vi.fn()
    render(<VaultDoor onDone={onDone} />)
    const door = screen.getByTestId('vault-door')
    expect(door).toHaveAttribute('aria-hidden', 'true')
    fireEvent.click(door)
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
