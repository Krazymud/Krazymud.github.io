import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ASSETS_DONE, CHUNK_SHARE, getLoading, resetLoading, setLoading, stageProgress, useLoading } from './loading'

describe('loading progress', () => {
  beforeEach(() => resetLoading())

  it('counts the 3D code as the first 30 percent and the assets up to 95, leaving the rest for the first frame', () => {
    expect(stageProgress(false, 0.9)).toBe(0)
    expect(stageProgress(true, 0)).toBe(CHUNK_SHARE)
    expect(stageProgress(true, 0.5)).toBeCloseTo(0.625)
    expect(stageProgress(true, 2)).toBe(ASSETS_DONE)
    expect(ASSETS_DONE).toBeLessThan(1)
  })

  it('starts empty and tells hook users about changes', () => {
    expect(getLoading()).toEqual({ kind: '3d', fraction: 0 })
    const { result } = renderHook(() => useLoading())
    act(() => setLoading({ kind: 'still', fraction: 1 }))
    expect(result.current).toEqual({ kind: 'still', fraction: 1 })
  })

  it('tells hook users when it is reset', () => {
    const { result } = renderHook(() => useLoading())
    act(() => setLoading({ kind: 'still', fraction: 1 }))
    act(() => resetLoading())
    expect(result.current).toEqual({ kind: '3d', fraction: 0 })
  })
})
