import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stopAll, unlockAudio } from '../audio/sound'
import { copy } from '../config/copy'
import { routes } from './routes'

vi.mock('../audio/sound', () => ({
  play: vi.fn(async () => undefined),
  stopAll: vi.fn(),
  unlockAudio: vi.fn(),
}))

function renderHome() {
  const router = createMemoryRouter(routes, { initialEntries: ['/'] })
  render(<RouterProvider router={router} />)
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  fireEvent(document, new Event('visibilitychange'))
}

describe('Layout', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(stopAll).mockClear()
    vi.mocked(unlockAudio).mockReset()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404, statusText: 'Not Found' })),
    )
  })
  afterEach(() => {
    Reflect.deleteProperty(document, 'visibilityState')
    vi.unstubAllGlobals()
  })

  it('stops every sound when the page is hidden', () => {
    renderHome()
    setVisibility('visible')
    expect(stopAll).not.toHaveBeenCalled()
    setVisibility('hidden')
    expect(stopAll).toHaveBeenCalledTimes(1)
  })

  it('does not float a mute control on the darkroom home', () => {
    renderHome()
    expect(screen.queryByRole('button', { name: '静音' })).toBeNull()
  })

  it('uses immersive darkroom shell without light glass nav', async () => {
    renderHome()
    expect(document.querySelector('header')).toBeNull()
    expect(document.querySelector('[data-shell="immersive"]')).not.toBeNull()
    expect(screen.queryByRole('link', { name: '日课' })).toBeNull()
    expect(screen.queryByRole('link', { name: '锦匣' })).toBeNull()
    await waitFor(() => expect(screen.getByText(copy.siteName)).toBeInTheDocument())
  })

  it('unlocks audio on any pointer, click or key press', () => {
    renderHome()
    const shell = document.querySelector('[data-shell="immersive"]')!
    fireEvent.pointerDown(shell)
    expect(unlockAudio).toHaveBeenCalledTimes(1)
    fireEvent.click(shell)
    expect(unlockAudio).toHaveBeenCalled()
    fireEvent.keyDown(shell, { key: 'Enter' })
    expect(unlockAudio).toHaveBeenCalled()
  })
})
