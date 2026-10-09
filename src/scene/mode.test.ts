import { beforeEach, describe, expect, it } from 'vitest'
import { markSceneFailed, resetSceneFailure, sceneFailed, sceneMode, supportsWebGL2 } from './mode'

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
  it('reports no WebGL 2 where the browser has none', () => {
    expect(supportsWebGL2()).toBe(false)
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
