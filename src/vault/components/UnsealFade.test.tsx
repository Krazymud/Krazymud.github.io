import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UNSEAL_MS, UnsealFade } from './UnsealFade'

describe('UnsealFade', () => {
  afterEach(() => vi.useRealTimers())

  it('finishes within 400ms', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<UnsealFade onDone={onDone} />)
    act(() => { vi.advanceTimersByTime(UNSEAL_MS - 1) })
    expect(onDone).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('skips on tap and stays aria-hidden', () => {
    const onDone = vi.fn()
    render(<UnsealFade onDone={onDone} />)
    const el = screen.getByTestId('unseal-fade')
    expect(el).toHaveAttribute('aria-hidden', 'true')
    fireEvent.click(el)
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
