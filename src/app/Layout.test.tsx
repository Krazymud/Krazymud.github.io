import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stopAll, unlockAudio } from '../audio/sound'
import { getPrefs } from '../prefs/prefs'
import { ProgressProvider } from '../progress/ProgressProvider'
import { routes } from './routes'

vi.mock('../audio/sound', () => ({ play: vi.fn(async () => undefined), stopAll: vi.fn(), unlockAudio: vi.fn() }))

function renderSettings() {
  const router = createMemoryRouter(routes, { initialEntries: ['/settings'] })
  render(
    <ProgressProvider>
      <RouterProvider router={router} />
    </ProgressProvider>,
  )
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  fireEvent(document, new Event('visibilitychange'))
}

describe('Layout', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(stopAll).mockClear()
    vi.mocked(unlockAudio).mockClear()
  })
  afterEach(() => {
    Reflect.deleteProperty(document, 'visibilityState')
  })

  it('stops every sound when the page is hidden', () => {
    renderSettings()
    setVisibility('visible')
    expect(stopAll).not.toHaveBeenCalled()
    setVisibility('hidden')
    expect(stopAll).toHaveBeenCalledTimes(1)
  })

  it('stops every sound when muted and loads them again when unmuted', () => {
    renderSettings()
    const mute = screen.getByRole('button', { name: '静音' })
    fireEvent.click(mute)
    expect(getPrefs().muted).toBe(true)
    expect(stopAll).toHaveBeenCalledTimes(1)
    vi.mocked(unlockAudio).mockClear()
    fireEvent.click(mute)
    expect(getPrefs().muted).toBe(false)
    expect(stopAll).toHaveBeenCalledTimes(1)
    expect(unlockAudio).toHaveBeenCalledTimes(2)
  })

  it('unlocks audio on any pointer, click or key press', () => {
    renderSettings()
    const page = screen.getByRole('heading', { name: '设置' })
    fireEvent.pointerDown(page)
    expect(unlockAudio).toHaveBeenCalledTimes(1)
    fireEvent.click(page)
    expect(unlockAudio).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(page, { key: 'Enter' })
    expect(unlockAudio).toHaveBeenCalledTimes(3)
  })
})
