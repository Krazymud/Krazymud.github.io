import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { play, stopAll, unlockAudio } from '../audio/sound'
import { copy } from '../config/copy'
import { getPrefs } from '../prefs/prefs'
import { routes } from './routes'

vi.mock('../audio/sound', () => ({
  play: vi.fn(async () => undefined),
  stopAll: vi.fn(),
  unlockAudio: vi.fn(),
}))

function renderHome() {
  const router = createMemoryRouter(routes, { initialEntries: ['/'] })
  render(
    <RouterProvider router={router} />,
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
    vi.mocked(unlockAudio).mockReset()
  })
  afterEach(() => {
    Reflect.deleteProperty(document, 'visibilityState')
  })

  it('stops every sound when the page is hidden', () => {
    renderHome()
    setVisibility('visible')
    expect(stopAll).not.toHaveBeenCalled()
    setVisibility('hidden')
    expect(stopAll).toHaveBeenCalledTimes(1)
  })

  it('stops every sound when muted and loads them again when unmuted', () => {
    renderHome()
    const mute = screen.getByRole('button', { name: '静音' })
    fireEvent.click(mute)
    expect(getPrefs().muted).toBe(true)
    expect(stopAll).toHaveBeenCalledTimes(1)
    vi.mocked(unlockAudio).mockClear()
    const mutedAtUnlock: boolean[] = []
    vi.mocked(unlockAudio).mockImplementation(() => {
      mutedAtUnlock.push(getPrefs().muted)
    })
    fireEvent.click(mute)
    expect(getPrefs().muted).toBe(false)
    expect(stopAll).toHaveBeenCalledTimes(1)
    expect(unlockAudio).toHaveBeenCalledTimes(2)
    expect(mutedAtUnlock).toEqual([true, false])
  })

  it('shows 暗房 branding without legacy nav links', () => {
    renderHome()
    const header = document.querySelector('header')!
    expect(header).toHaveTextContent(copy.siteName)
    expect(screen.getByRole('link', { name: copy.nav.home })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '日课' })).toBeNull()
    expect(screen.queryByRole('link', { name: '锦匣' })).toBeNull()
    expect(screen.queryByRole('link', { name: '案头' })).toBeNull()
    expect(screen.queryByText('MIDNIGHT GARAGE')).toBeNull()
  })

  it('plays tap when navigating home', () => {
    renderHome()
    vi.mocked(play).mockClear()
    fireEvent.click(screen.getByRole('link', { name: copy.nav.home }))
    expect(play).toHaveBeenCalledWith('tap')
  })

  it('unlocks audio on any pointer, click or key press', () => {
    renderHome()
    const page = screen.getByRole('link', { name: copy.nav.home })
    fireEvent.pointerDown(page)
    expect(unlockAudio).toHaveBeenCalledTimes(1)
    fireEvent.click(page)
    expect(unlockAudio).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(page, { key: 'Enter' })
    expect(unlockAudio).toHaveBeenCalledTimes(3)
  })
})
