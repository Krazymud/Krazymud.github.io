import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetSound, setAudioContextFactory } from '../audio/sound'
import { copy } from '../config/copy'
import { resetPrefsCache } from '../prefs/prefs'
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

  function stubEmptyVault() {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404, statusText: 'Not Found' })),
    )
  }

  it('loads the Darkroom entry on /', async () => {
    stubEmptyVault()
    renderAt('/')
    const main = screen.getByRole('main')
    expect(await within(main).findByText(copy.siteName)).toBeInTheDocument()
  })

  it('redirects /trial to home', async () => {
    stubEmptyVault()
    renderAt('/trial')
    const main = screen.getByRole('main')
    expect(await within(main).findByText(copy.siteName)).toBeInTheDocument()
    expect(screen.queryByText(/日课/)).toBeNull()
  })

  it('redirects unknown paths to the Darkroom entry', async () => {
    stubEmptyVault()
    renderAt('/2018/09/05/leetcode05/')
    const main = screen.getByRole('main')
    expect(await within(main).findByText(copy.siteName)).toBeInTheDocument()
  })

  it('uses immersive darkroom shell on home (no light glass chrome)', async () => {
    stubEmptyVault()
    renderAt('/')
    await within(screen.getByRole('main')).findByText(copy.siteName)
    expect(document.querySelector('[data-shell="immersive"]')).toBeTruthy()
    expect(screen.queryByRole('banner')).toBeNull()
    expect(document.querySelector('main')?.className ?? '').not.toMatch(/glass-panel-solid/)
  })

  it('does not float a mute control over the darkroom', async () => {
    stubEmptyVault()
    renderAt('/')
    await within(screen.getByRole('main')).findByText(copy.siteName)
    expect(screen.queryByRole('button', { name: '静音' })).toBeNull()
  })
})
