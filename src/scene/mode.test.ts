import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { markSceneFailed, resetSceneFailure, resetWebGL2Cache, sceneFailed, sceneMode, supportsWebGL2 } from './mode'

const OK = { reducedMotion: false, webgl2: true, enabled: true, failed: false }

describe('sceneMode', () => {
  it('uses 3D only when nothing rules it out', () => {
    expect(sceneMode(OK)).toBe('3d')
    expect(sceneMode({ ...OK, reducedMotion: true })).toBe('still')
    expect(sceneMode({ ...OK, webgl2: false })).toBe('still')
    expect(sceneMode({ ...OK, enabled: false })).toBe('still')
    expect(sceneMode({ ...OK, failed: true })).toBe('still')
  })
})

describe('WebGL 2 detection', () => {
  beforeEach(() => resetWebGL2Cache())
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function fakeWebGL2() {
    const loseContext = vi.fn()
    vi.stubGlobal('WebGL2RenderingContext', class {})
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation((() => ({ getExtension: () => ({ loseContext }) })) as unknown as HTMLCanvasElement['getContext'])
    return { getContext, loseContext }
  }

  it('reports no WebGL 2 where the browser has none', () => {
    expect(supportsWebGL2()).toBe(false)
  })

  it('reports WebGL 2 and releases the probe context', () => {
    const { getContext, loseContext } = fakeWebGL2()
    expect(supportsWebGL2()).toBe(true)
    expect(getContext).toHaveBeenCalledWith('webgl2')
    expect(loseContext).toHaveBeenCalledTimes(1)
  })

  it('probes only once per visit', () => {
    const { getContext } = fakeWebGL2()
    supportsWebGL2()
    supportsWebGL2()
    expect(getContext).toHaveBeenCalledTimes(1)
  })
})

describe('failure memory', () => {
  beforeEach(() => resetSceneFailure())

  it('remembers a failure for the rest of the visit', () => {
    expect(sceneFailed()).toBe(false)
    markSceneFailed()
    expect(sceneFailed()).toBe(true)
  })
})
