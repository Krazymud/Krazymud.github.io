import { act, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetPrefsCache, setPrefs } from '../prefs/prefs'
import { getLoading, resetLoading } from './loading'
import { resetSceneFailure, sceneFailed } from './mode'
import { SceneHost } from './SceneHost'
import type { StageModule, StageProps } from './types'

function fakeStage(behaviour: 'ready' | 'fail' | 'wait'): StageModule {
  function Stage({ scene, onReady, onFail }: StageProps) {
    useEffect(() => {
      if (behaviour === 'ready') onReady()
      if (behaviour === 'fail') onFail('test')
    }, [onReady, onFail])
    return <div data-testid="fake-stage">{scene}</div>
  }
  return { Stage }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const still = () => screen.queryByTestId('scene-still')
const yes = () => true

describe('SceneHost', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPrefsCache()
    resetSceneFailure()
    resetLoading()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows only the still without WebGL 2', async () => {
    const loadStage = vi.fn(async () => fakeStage('ready'))
    render(<SceneHost scene="garage" loadStage={loadStage} webgl2={() => false} />)
    await pause(30)
    expect(still()).toBeInTheDocument()
    expect(loadStage).not.toHaveBeenCalled()
  })

  it('shows only the still when the system asks for reduced motion', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    const loadStage = vi.fn(async () => fakeStage('ready'))
    render(<SceneHost scene="garage" loadStage={loadStage} webgl2={yes} />)
    await pause(30)
    expect(loadStage).not.toHaveBeenCalled()
  })

  it('shows only the still when 3D is switched off in settings', async () => {
    setPrefs({ scene3d: false })
    const loadStage = vi.fn(async () => fakeStage('ready'))
    render(<SceneHost scene="garage" loadStage={loadStage} webgl2={yes} />)
    await pause(30)
    expect(loadStage).not.toHaveBeenCalled()
  })

  it('loads the 3D stage, fades it in and then removes the still', async () => {
    render(<SceneHost scene="track" loadStage={async () => fakeStage('ready')} webgl2={yes} />)
    expect(await screen.findByTestId('fake-stage')).toHaveTextContent('track')
    expect(still()).toBeInTheDocument()
    await waitFor(() => expect(still()).toBeNull(), { timeout: 2000 })
  })

  it('stays on the still and does not retry when the bundle fails to load', async () => {
    const loadStage = vi.fn(async (): Promise<StageModule> => {
      throw new Error('offline')
    })
    const { unmount } = render(<SceneHost scene="garage" loadStage={loadStage} webgl2={yes} />)
    await waitFor(() => expect(sceneFailed()).toBe(true))
    expect(still()).toBeInTheDocument()
    unmount()
    render(<SceneHost scene="garage" loadStage={loadStage} webgl2={yes} />)
    await pause(30)
    expect(loadStage).toHaveBeenCalledTimes(1)
  })

  it('falls back to the still when the stage reports a failure', async () => {
    render(<SceneHost scene="garage" loadStage={async () => fakeStage('fail')} webgl2={yes} />)
    await waitFor(() => expect(sceneFailed()).toBe(true))
    expect(screen.queryByTestId('fake-stage')).toBeNull()
    expect(still()).toBeInTheDocument()
  })

  it('drops the 3D stage as soon as 3D is switched off', async () => {
    render(<SceneHost scene="garage" loadStage={async () => fakeStage('wait')} webgl2={yes} />)
    await screen.findByTestId('fake-stage')
    act(() => setPrefs({ scene3d: false }))
    expect(screen.queryByTestId('fake-stage')).toBeNull()
    expect(still()).toBeInTheDocument()
  })

  it('brings the 3D stage back when 3D is switched on again', async () => {
    render(<SceneHost scene="garage" loadStage={async () => fakeStage('ready')} webgl2={yes} />)
    await screen.findByTestId('fake-stage')
    await waitFor(() => expect(still()).toBeNull(), { timeout: 2000 })
    act(() => setPrefs({ scene3d: false }))
    expect(screen.queryByTestId('fake-stage')).toBeNull()
    expect(still()).toBeInTheDocument()
    act(() => setPrefs({ scene3d: true }))
    expect(await screen.findByTestId('fake-stage')).toBeInTheDocument()
    expect(still()).toBeInTheDocument()
    await waitFor(() => expect(still()).toBeNull(), { timeout: 2000 })
    expect(sceneFailed()).toBe(false)
  })

  it('reports still mode to the loading progress', async () => {
    render(<SceneHost scene="garage" webgl2={() => false} />)
    await waitFor(() => expect(getLoading()).toEqual({ kind: 'still', fraction: 1 }))
  })

  it('reports 3D loading progress until the first frame', async () => {
    let report: ((fraction: number) => void) | undefined
    let ready: (() => void) | undefined
    function Stage({ onReady, onProgress }: StageProps) {
      report = onProgress
      ready = onReady
      return <div data-testid="fake-stage" />
    }
    render(<SceneHost scene="garage" loadStage={async () => ({ Stage })} webgl2={yes} />)
    await screen.findByTestId('fake-stage')
    await waitFor(() => expect(getLoading()).toEqual({ kind: '3d', fraction: 0.3 }))
    act(() => report?.(0.5))
    expect(getLoading().fraction).toBeCloseTo(0.65)
    act(() => report?.(0.2))
    expect(getLoading().fraction).toBeCloseTo(0.65)
    act(() => ready?.())
    expect(getLoading()).toEqual({ kind: '3d', fraction: 1 })
  })

  it('starts the asset progress over when 3D is switched back on', async () => {
    let report: ((fraction: number) => void) | undefined
    function Stage({ onProgress }: StageProps) {
      report = onProgress
      return <div data-testid="fake-stage" />
    }
    render(<SceneHost scene="garage" loadStage={async () => ({ Stage })} webgl2={yes} />)
    await screen.findByTestId('fake-stage')
    act(() => report?.(0.8))
    expect(getLoading().fraction).toBeCloseTo(0.86)
    act(() => setPrefs({ scene3d: false }))
    act(() => setPrefs({ scene3d: true }))
    await screen.findByTestId('fake-stage')
    expect(getLoading()).toEqual({ kind: '3d', fraction: 0.3 })
    act(() => report?.(0.5))
    expect(getLoading().fraction).toBeCloseTo(0.65)
  })

  it('dims the scene for each page', () => {
    const { rerender } = render(<SceneHost scene="track" webgl2={() => false} />)
    expect(screen.getByTestId('scene-dim').style.opacity).toBe('0.45')
    rerender(<SceneHost scene="garage" webgl2={() => false} />)
    expect(screen.getByTestId('scene-dim').style.opacity).toBe('0')
  })
})
