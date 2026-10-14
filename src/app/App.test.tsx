import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetSound, setAudioContextFactory } from '../audio/sound'
import { copy } from '../config/copy'
import { site } from '../config/site'
import { PREFS_KEY, resetPrefsCache } from '../prefs/prefs'
import { ProgressProvider } from '../progress/ProgressProvider'
import { routes } from './routes'

vi.mock('../scene/three/StillsPage', () => ({ StillsPage: () => <p>stills</p> }))

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <ProgressProvider>
      <RouterProvider router={router} />
    </ProgressProvider>,
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

  it('greets her in the garage with today\'s trial status', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copy.home.hello(site.nickname))
    expect(screen.getByText('0 / 20')).toBeInTheDocument()
    expect(screen.getByText(copy.home.trialToday)).toBeInTheDocument()
  })

  it('does not set a vault data-theme on the layout shell', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })))
    renderAt('/vault')
    expect(document.querySelector('[data-theme="vault"]')).toBeNull()
    expect(await screen.findByText('保险库还是空的。', {}, { timeout: 5000 })).toBeInTheDocument()
  })

  it('shows the sketch backdrop behind the garage page', () => {
    renderAt('/')
    expect(screen.getByTestId('sketch-stage')).toBeInTheDocument()
  })

  it('redirects unknown paths to the garage', async () => {
    renderAt('/2018/09/05/leetcode05/')
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(copy.home.hello(site.nickname))
  })

  it('shows the garage greeting and sketch layer on a first visit', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copy.home.hello(site.nickname))
    expect(screen.getByTestId('sketch-stage')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '点火开场' })).toBeNull()
    expect(screen.queryByRole('status', { name: '引擎预热' })).toBeNull()
    expect(document.querySelector('header')).not.toHaveAttribute('inert')
    expect(document.querySelector('main')).not.toHaveAttribute('inert')
  })

  it('opens the dev stills page without a missing fallback warning', async () => {
    const warn = vi.spyOn(console, 'warn')
    renderAt('/__stills')
    expect(await screen.findByText('stills')).toBeInTheDocument()
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('HydrateFallback'))
  })

  it('mutes and unmutes from the top bar', () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ArrayBuffer(8))))
    setAudioContextFactory(() => ({ state: 'running', decodeAudioData: async () => ({}) }) as unknown as AudioContext)
    renderAt('/settings')
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
