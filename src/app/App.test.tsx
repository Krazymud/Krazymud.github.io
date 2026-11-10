import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetSound, setAudioContextFactory } from '../audio/sound'
import { copy } from '../config/copy'
import { PREFS_KEY, resetPrefsCache } from '../prefs/prefs'
import { routes } from './routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <RouterProvider router={router} />,
  )
}

describe('app shell', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPrefsCache()
  })
  afterEach(() => {
    resetSound()
    setAudioContextFactory(null)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads the Darkroom entry on /', async () => {
    renderAt('/')
    expect(screen.getByRole('banner')).toHaveTextContent(copy.siteName)
    const main = screen.getByRole('main')
    expect(await within(main).findByText('暗房')).toBeInTheDocument()
  })

  it('redirects /trial to home', async () => {
    renderAt('/trial')
    const main = screen.getByRole('main')
    expect(await within(main).findByText('暗房')).toBeInTheDocument()
    expect(screen.queryByText(/日课/)).toBeNull()
  })

  it('redirects unknown paths to the Darkroom entry', async () => {
    renderAt('/2018/09/05/leetcode05/')
    const main = screen.getByRole('main')
    expect(await within(main).findByText('暗房')).toBeInTheDocument()
  })

  it('uses an open shell on home', () => {
    renderAt('/')
    expect(document.querySelector('[data-shell="home"]')).toBeTruthy()
    expect(document.querySelector('main')?.className ?? '').not.toMatch(/glass-panel-solid/)
  })

  it('mutes and unmutes from the top bar', () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ArrayBuffer(8))))
    setAudioContextFactory(() => ({ state: 'running', decodeAudioData: async () => ({}) }) as unknown as AudioContext)
    renderAt('/')
    const mute = screen.getByRole('button', { name: '静音' })
    expect(mute).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(mute)
    expect(mute).toHaveAccessibleName('静音')
    expect(mute).toHaveAttribute('aria-pressed', 'true')
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!).muted).toBe(true)
    fireEvent.click(mute)
    expect(mute).toHaveAttribute('aria-pressed', 'false')
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!).muted).toBe(false)
  })
})
