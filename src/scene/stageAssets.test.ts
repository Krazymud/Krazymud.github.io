import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PREFS_KEY } from '../prefs/key'
import { EARLY_FETCHES, earlyFetchScript } from './stageAssets'

const run = (stageScript?: string) => new Function(earlyFetchScript({ prefsKey: PREFS_KEY, urls: ['/a.glb', '/b.webp'], stageScript }))()
const fetches = () => (window as unknown as Record<string, Record<string, unknown> | undefined>)[EARLY_FETCHES]
const preloads = () => [...document.head.querySelectorAll('link[rel=modulepreload]')].map((link) => link.getAttribute('href'))

describe('earlyFetchScript', () => {
  let fetcher: ReturnType<typeof vi.fn>
  beforeEach(() => {
    localStorage.clear()
    document.head.innerHTML = ''
    delete (window as unknown as Record<string, unknown>)[EARLY_FETCHES]
    fetcher = vi.fn(async () => new Response('x'))
    vi.stubGlobal('fetch', fetcher)
    vi.stubGlobal('WebGL2RenderingContext', class {})
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('starts the 3D code and asset downloads straight from the page head', () => {
    run('/assets/Stage-x.js')
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/a.glb', '/b.webp'])
    expect(Object.keys(fetches() ?? {})).toEqual(['/a.glb', '/b.webp'])
    expect(preloads()).toEqual(['/assets/Stage-x.js'])
  })

  it('waits for the main code to finish downloading before starting', () => {
    let notify: ((list: { getEntries: () => { name: string }[] }) => void) | undefined
    vi.stubGlobal(
      'PerformanceObserver',
      class {
        constructor(callback: typeof notify) {
          notify = callback
        }
        observe() {}
        disconnect() {}
      },
    )
    new Function(earlyFetchScript({ prefsKey: PREFS_KEY, urls: ['/a.glb'], mainScript: '/assets/index-x.js' }))()
    notify?.({ getEntries: () => [{ name: 'https://site/assets/index-DOy.css' }] })
    expect(fetcher).not.toHaveBeenCalled()
    notify?.({ getEntries: () => [{ name: 'https://site/assets/index-x.js' }] })
    notify?.({ getEntries: () => [{ name: 'https://site/assets/index-x.js' }] })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('leaves the downloads to the app once it has started them itself', () => {
    ;(window as unknown as Record<string, unknown>)[EARLY_FETCHES] = {}
    run()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('downloads nothing when 3D is switched off', () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ scene3d: false }))
    run('/assets/Stage-x.js')
    expect(fetcher).not.toHaveBeenCalled()
    expect(preloads()).toEqual([])
  })

  it('downloads nothing when motion is reduced or WebGL 2 is missing', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }))
    run()
    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', fetcher)
    vi.stubGlobal('WebGL2RenderingContext', undefined)
    run()
    expect(fetcher).not.toHaveBeenCalled()
  })
})
