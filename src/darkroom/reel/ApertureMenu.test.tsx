import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApertureMenu } from './ApertureMenu'
import { ReelRadioProvider } from './ReelRadio'

const openPolaroid = vi.fn()
const readBlob = vi.fn()

vi.mock('./PolaroidTakeHome', () => ({
  usePolaroidTakeHome: () => ({ open: openPolaroid }),
}))

vi.mock('../VaultBridge', () => ({
  useDarkroomVault: () => ({
    photos: [
      { source: 's1', thumb: 't1', caption: '测试', date: '2020-01-01', width: 1, height: 1 },
    ],
    readBlob,
  }),
}))

function wrap(ui: React.ReactNode) {
  return <ReelRadioProvider>{ui}</ReelRadioProvider>
}

describe('ApertureMenu', () => {
  beforeEach(() => {
    localStorage.clear()
    openPolaroid.mockClear()
    readBlob.mockResolvedValue(new Uint8Array([1, 2, 3]))
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('opens settings and persists clarity and light prefs', () => {
    render(wrap(<ApertureMenu />))
    fireEvent.click(screen.getByRole('button', { name: /光圈/i }))
    expect(screen.getByTestId('aperture-panel')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /清晰.*标准/i }))
    expect(localStorage.getItem('darkroom.q')).toBe('1')

    fireEvent.click(screen.getByRole('button', { name: /灯光.*简洁/i }))
    expect(localStorage.getItem('darkroom.light')).toBe('simple')
  })

  it('toggles music mute via radio row', () => {
    render(wrap(<ApertureMenu />))
    fireEvent.click(screen.getByRole('button', { name: /光圈/i }))
    const toggle = screen.getByRole('button', { name: /音乐：开/i })
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: /音乐：关/i })).toBeInTheDocument()
  })

  it('adjusts volume slider', () => {
    render(wrap(<ApertureMenu />))
    fireEvent.click(screen.getByRole('button', { name: /光圈/i }))
    const slider = screen.getByLabelText(/音量/i) as HTMLInputElement
    fireEvent.change(slider, { target: { value: '0.25' } })
    expect(slider.value).toBe('0.25')
  })

  it('offers polaroid take-home when vault has photos', async () => {
    render(wrap(<ApertureMenu />))
    fireEvent.click(screen.getByRole('button', { name: /光圈/i }))
    fireEvent.click(screen.getByRole('button', { name: /拍立得带走/i }))
    await waitFor(() => expect(openPolaroid).toHaveBeenCalled())
  })
})
